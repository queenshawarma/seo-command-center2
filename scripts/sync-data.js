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

// ============================================
// كشف التراجعات وتسجيل تنبيهات تلقائية
// ============================================

function fmtDate(d) {
  return d.toISOString().split('T')[0];
}

async function detectDrops() {
  const { data: sites } = await supabase.from('sites').select('*').eq('status', 'active');
  if (!sites) return;

  const today = new Date();
  const start14 = new Date(today);
  start14.setDate(today.getDate() - 17); // نجيب آخر 14 يوم فعلي (مع هامش تأخر GSC)

  for (const site of sites) {
    const { data: metrics } = await supabase
      .from('metrics_daily')
      .select('date, clicks, sessions')
      .eq('site_id', site.id)
      .gte('date', fmtDate(start14))
      .order('date', { ascending: true });

    if (!metrics || metrics.length === 0) continue;

    // ندمج clicks + sessions لكل يوم (ممكن ييجوا في صفين منفصلين GSC/GA4)
    const byDate = {};
    metrics.forEach(m => {
      if (!byDate[m.date]) byDate[m.date] = { clicks: 0, sessions: 0 };
      byDate[m.date].clicks += m.clicks || 0;
      byDate[m.date].sessions += m.sessions || 0;
    });

    const dates = Object.keys(byDate).sort();
    const last7 = dates.slice(-7);
    const prev7 = dates.slice(-14, -7);
    if (last7.length < 5 || prev7.length < 5) continue; // مش كفاية بيانات للمقارنة

    const sum = (arr, key) => arr.reduce((s, d) => s + (byDate[d]?.[key] || 0), 0);
    const clicks7 = sum(last7, 'clicks');
    const clicksPrev7 = sum(prev7, 'clicks');

    if (clicksPrev7 >= 10) { // نتجاهل المواقع الصغيرة جداً عشان منطلعش إنذارات وهمية
      const dropPct = Math.round(((clicksPrev7 - clicks7) / clicksPrev7) * 100);
      if (dropPct >= 20) {
        // نتجنب تكرار نفس التنبيه لو اتسجل خلال آخر 3 أيام
        const { data: recentAlert } = await supabase
          .from('alerts')
          .select('id')
          .eq('site_id', site.id)
          .eq('type', 'traffic_drop')
          .gte('created_at', new Date(today.getTime() - 3 * 86400000).toISOString())
          .limit(1);

        if (!recentAlert || recentAlert.length === 0) {
          const severity = dropPct >= 40 ? 'high' : 'medium';
          await supabase.from('alerts').insert({
            site_id: site.id,
            type: 'traffic_drop',
            severity,
            message: `تراجع في النقرات بنسبة ${dropPct}% خلال آخر 7 أيام (من ${clicksPrev7} إلى ${clicks7}) مقارنة بالأسبوع السابق.`,
          });
          console.log(`  ⚠ تنبيه جديد لـ ${site.name}: تراجع ${dropPct}%`);
        }
      }
    }
  }
}

run()
  .then(() => detectDrops())
  .then(() => console.log('تم فحص كل المواقع بحثاً عن تراجعات.'))
  .catch(err => {
    console.error('فشل السكريبت:', err);
    process.exit(1);
  });

