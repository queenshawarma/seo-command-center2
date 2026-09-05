'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

function fmtDate(d) {
  return d.toISOString().split('T')[0];
}

function pctChange(current, previous) {
  if (!previous) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

// سباركلاين بسيط بدون أي مكتبة خارجية
function Sparkline({ values, color = '#3b82f6' }) {
  if (!values.length) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const w = 200, h = 40;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1 || 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-10">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" />
    </svg>
  );
}

function TrendBadge({ pct }) {
  const isUp = pct >= 0;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${isUp ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'}`}>
      {isUp ? '▲' : '▼'} {Math.abs(pct)}%
    </span>
  );
}

export default function Dashboard() {
  const [siteCards, setSiteCards] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: sites, error: sitesError } = await supabase.from('sites').select('*').eq('status', 'active');
      console.log('DEBUG sites:', sites, 'error:', sitesError);
      if (!sites || sites.length === 0) { setLoading(false); return; }

      const today = new Date();
      const start30 = new Date(today); start30.setDate(today.getDate() - 33);

      const { data: metrics, error: metricsError } = await supabase
        .from('metrics_daily')
        .select('*')
        .gte('date', fmtDate(start30))
        .order('date', { ascending: true });
      console.log('DEBUG metrics count:', metrics?.length, 'error:', metricsError, 'sample:', metrics?.[0]);

      const cards = sites.map(site => {
        const siteMetrics = (metrics || []).filter(m => m.site_id === site.id);

        // ندمج بيانات كل يوم (gsc + ga4) في قيمة واحدة لكل يوم
        const byDate = {};
        siteMetrics.forEach(m => {
          if (!byDate[m.date]) byDate[m.date] = { clicks: 0, impressions: 0, sessions: 0 };
          byDate[m.date].clicks += m.clicks || 0;
          byDate[m.date].impressions += m.impressions || 0;
          byDate[m.date].sessions += m.sessions || 0;
        });

        const dates = Object.keys(byDate).sort();
        const last30Clicks = dates.slice(-30).map(d => byDate[d].clicks);

        const last7 = dates.slice(-7);
        const prev7 = dates.slice(-14, -7);
        const sum = (arr, key) => arr.reduce((s, d) => s + (byDate[d]?.[key] || 0), 0);

        const clicks7 = sum(last7, 'clicks');
        const clicksPrev7 = sum(prev7, 'clicks');
        const sessions7 = sum(last7, 'sessions');
        const sessionsPrev7 = sum(prev7, 'sessions');
        const impressions7 = sum(last7, 'impressions');

        return {
          site,
          clicks7, sessions7, impressions7,
          clicksTrend: pctChange(clicks7, clicksPrev7),
          sessionsTrend: pctChange(sessions7, sessionsPrev7),
          sparkline: last30Clicks,
          hasData: dates.length > 0,
        };
      });

      setSiteCards(cards);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <p className="text-gray-400 text-sm">جاري تحميل البيانات...</p>;

  if (siteCards.length === 0) {
    return (
      <div className="bg-[#181b21] rounded-xl p-6 border border-gray-800">
        <p className="text-gray-400 text-sm">لسه مفيش مواقع مضافة. روحي صفحة "المواقع" وضيفي أول موقع.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold mb-2">لوحة اليوم — آخر 7 أيام مقابل الـ 7 اللي قبلها</h2>
      <div className="grid md:grid-cols-2 gap-4">
        {siteCards.map(card => (
          <div key={card.site.id} className="bg-[#181b21] p-5 rounded-xl border border-gray-800 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold">{card.site.name}</p>
                <p className="text-gray-500 text-xs">{card.site.domain}</p>
              </div>
              {!card.hasData && (
                <span className="text-xs text-yellow-500">لسه مفيش بيانات كافية</span>
              )}
            </div>

            {card.hasData && (
              <>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-gray-500 text-xs">نقرات (7 أيام)</p>
                    <p className="font-semibold">{card.clicks7}</p>
                    <TrendBadge pct={card.clicksTrend} />
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">ظهور (7 أيام)</p>
                    <p className="font-semibold">{card.impressions7}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">جلسات (7 أيام)</p>
                    <p className="font-semibold">{card.sessions7}</p>
                    <TrendBadge pct={card.sessionsTrend} />
                  </div>
                </div>
                <Sparkline values={card.sparkline} />
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
