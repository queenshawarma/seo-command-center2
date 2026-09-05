// scripts/sync-data.js
// السكريبت ده بيتنفذ يومياً عن طريق GitHub Actions
// بيسحب بيانات GSC وGA4 لكل موقع مسجل في جدول sites، ويخزنها في metrics_daily

const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');
const { BetaAnalyticsDataClient } = require('@google-analytics/data');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// قراءة مفتاح الـ Service Account من الـ Secret (متخزن كـ JSON string كامل)
const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);

function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 3); // بيانات GSC بتتأخر لمدة 2-3 أيام عادةً
  return d.toISOString().split('T')[0];
}

async function fetchGSC(gscProperty) {
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  });
  const searchconsole = google.searchconsole({ version: 'v1', auth });
  const date = yesterday();

  const res = await searchconsole.searchanalytics.query({
    siteUrl: gscProperty,
    requestBody: {
      startDate: date,
      endDate: date,
      dimensions: ['date'],
    },
  });

  const row = res.data.rows?.[0];
  return {
    date,
    clicks: row?.clicks || 0,
    impressions: row?.impressions || 0,
    ctr: row?.ctr || 0,
    avg_position: row?.position || 0,
  };
}

async function fetchGA4(propertyId) {
  const client = new BetaAnalyticsDataClient({ credentials });
  const date = yesterday();

  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: date, endDate: date }],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
      { name: 'conversions' },
    ],
  });

  const row = response.rows?.[0];
  return {
    date,
    sessions: Number(row?.metricValues?.[0]?.value || 0),
    users: Number(row?.metricValues?.[1]?.value || 0),
    conversions: Number(row?.metricValues?.[2]?.value || 0),
  };
}

async function run() {
  const { data: sites, error } = await supabase.from('sites').select('*').eq('status', 'active');
  if (error) throw error;

  for (const site of sites) {
    console.log(`جاري سحب بيانات: ${site.name}`);

    if (site.gsc_property) {
      try {
        const gsc = await fetchGSC(site.gsc_property);
        await supabase.from('metrics_daily').upsert({
          site_id: site.id,
          date: gsc.date,
          source: 'gsc',
          clicks: gsc.clicks,
          impressions: gsc.impressions,
          ctr: gsc.ctr,
          avg_position: gsc.avg_position,
        }, { onConflict: 'site_id,date,source' });
        console.log(`  ✓ GSC تم بنجاح`);
      } catch (e) {
        console.error(`  ✗ خطأ في GSC لـ ${site.name}:`, e.message);
      }
    }

    if (site.ga4_property_id) {
      try {
        const ga4 = await fetchGA4(site.ga4_property_id);
        await supabase.from('metrics_daily').upsert({
          site_id: site.id,
          date: ga4.date,
          source: 'ga4',
          sessions: ga4.sessions,
          users: ga4.users,
          conversions: ga4.conversions,
        }, { onConflict: 'site_id,date,source' });
        console.log(`  ✓ GA4 تم بنجاح`);
      } catch (e) {
        console.error(`  ✗ خطأ في GA4 لـ ${site.name}:`, e.message);
      }
    }
  }
  console.log('خلص السحب لكل المواقع.');
}

run().catch(err => {
  console.error('فشل السكريبت:', err);
  process.exit(1);
});
