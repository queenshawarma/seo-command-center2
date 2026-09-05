// scripts/backfill-data.js
// السكريبت ده بيتشغل مرة واحدة بس يدوياً، بيسحب آخر 90 يوم من GSC وGA4
// لكل المواقع، ويخزنهم كلهم دفعة واحدة في metrics_daily

const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');
const { BetaAnalyticsDataClient } = require('@google-analytics/data');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);

const DAYS_BACK = 90; // ممكن تغيّريها لو عايزة فترة أطول أو أقصر

function dateRange() {
  const end = new Date();
  end.setDate(end.getDate() - 3); // GSC بتتأخر 2-3 أيام عادةً
  const start = new Date(end);
  start.setDate(start.getDate() - DAYS_BACK);
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  };
}

async function backfillGSC(gscProperty) {
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  });
  const searchconsole = google.searchconsole({ version: 'v1', auth });
  const { startDate, endDate } = dateRange();

  const res = await searchconsole.searchanalytics.query({
    siteUrl: gscProperty,
    requestBody: { startDate, endDate, dimensions: ['date'], rowLimit: 5000 },
  });

  return (res.data.rows || []).map(row => ({
    date: row.keys[0],
    clicks: row.clicks || 0,
    impressions: row.impressions || 0,
    ctr: row.ctr || 0,
    avg_position: row.position || 0,
  }));
}

async function backfillGA4(propertyId) {
  const client = new BetaAnalyticsDataClient({ credentials });
  const { startDate, endDate } = dateRange();

  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'date' }],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
      { name: 'conversions' },
    ],
  });

  return (response.rows || []).map(row => {
    const raw = row.dimensionValues[0].value; // format YYYYMMDD
    const date = `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}`;
    return {
      date,
      sessions: Number(row.metricValues?.[0]?.value || 0),
      users: Number(row.metricValues?.[1]?.value || 0),
      conversions: Number(row.metricValues?.[2]?.value || 0),
    };
  });
}

async function run() {
  const { data: sites, error } = await supabase.from('sites').select('*').eq('status', 'active');
  if (error) throw error;

  for (const site of sites) {
    console.log(`جاري التعبئة التاريخية لـ: ${site.name}`);

    if (site.gsc_property) {
      try {
        const rows = await backfillGSC(site.gsc_property);
        let successCount = 0;
        for (const r of rows) {
          const { error: upsertErr } = await supabase.from('metrics_daily').upsert({
            site_id: site.id, date: r.date, source: 'gsc',
            clicks: r.clicks, impressions: r.impressions,
            ctr: r.ctr, avg_position: r.avg_position,
          }, { onConflict: 'site_id,date,source' });
          if (upsertErr) {
            console.error(`  ✗ فشل حفظ يوم ${r.date} (GSC):`, upsertErr.message);
          } else {
            successCount++;
          }
        }
        console.log(`  ✓ GSC: تم تخزين ${successCount} من أصل ${rows.length} يوم`);
      } catch (e) {
        console.error(`  ✗ خطأ في GSC لـ ${site.name}:`, e.message);
      }
    }

    if (site.ga4_property_id) {
      try {
        const rows = await backfillGA4(site.ga4_property_id);
        let successCount = 0;
        for (const r of rows) {
          const { error: upsertErr } = await supabase.from('metrics_daily').upsert({
            site_id: site.id, date: r.date, source: 'ga4',
            sessions: r.sessions, users: r.users, conversions: r.conversions,
          }, { onConflict: 'site_id,date,source' });
          if (upsertErr) {
            console.error(`  ✗ فشل حفظ يوم ${r.date} (GA4):`, upsertErr.message);
          } else {
            successCount++;
          }
        }
        console.log(`  ✓ GA4: تم تخزين ${successCount} من أصل ${rows.length} يوم`);
      } catch (e) {
        console.error(`  ✗ خطأ في GA4 لـ ${site.name}:`, e.message);
      }
    }
  }
  console.log('خلصت التعبئة التاريخية لكل المواقع.');
}

run().catch(err => {
  console.error('فشل السكريبت:', err);
  process.exit(1);
});
