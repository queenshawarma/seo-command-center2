'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function SitesPage() {
  const [sites, setSites] = useState([]);
  const [form, setForm] = useState({ name: '', domain: '', gsc_property: '', ga4_property_id: '' });
  const [loading, setLoading] = useState(false);

  async function loadSites() {
    const { data, error } = await supabase.from('sites').select('*').order('created_at', { ascending: false });
    if (!error) setSites(data);
  }

  useEffect(() => { loadSites(); }, []);

  async function addSite(e) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from('sites').insert([form]);
    setLoading(false);
    if (error) { alert('حصل خطأ: ' + error.message); return; }
    setForm({ name: '', domain: '', gsc_property: '', ga4_property_id: '' });
    loadSites();
  }

  async function deleteSite(id) {
    if (!confirm('متأكد من حذف الموقع؟')) return;
    await supabase.from('sites').delete().eq('id', id);
    loadSites();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={addSite} className="bg-[#181b21] p-5 rounded-xl border border-gray-800 space-y-3">
        <h2 className="font-semibold mb-2">إضافة موقع جديد</h2>
        <div className="grid grid-cols-2 gap-3">
          <input required placeholder="اسم الموقع" value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            className="bg-[#0f1115] border border-gray-700 rounded-lg px-3 py-2 text-sm" />
          <input required placeholder="الدومين (example.com)" value={form.domain}
            onChange={e => setForm({ ...form, domain: e.target.value })}
            className="bg-[#0f1115] border border-gray-700 rounded-lg px-3 py-2 text-sm" />
          <input placeholder="GSC Property (sc-domain:example.com)" value={form.gsc_property}
            onChange={e => setForm({ ...form, gsc_property: e.target.value })}
            className="bg-[#0f1115] border border-gray-700 rounded-lg px-3 py-2 text-sm" />
          <input placeholder="GA4 Property ID" value={form.ga4_property_id}
            onChange={e => setForm({ ...form, ga4_property_id: e.target.value })}
            className="bg-[#0f1115] border border-gray-700 rounded-lg px-3 py-2 text-sm" />
        </div>
        <button disabled={loading} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm">
          {loading ? 'جاري الإضافة...' : '+ إضافة'}
        </button>
      </form>

      <div className="grid gap-3">
        {sites.map(site => (
          <div key={site.id} className="bg-[#181b21] p-4 rounded-xl border border-gray-800 flex justify-between items-center">
            <div>
              <p className="font-semibold">{site.name}</p>
              <p className="text-gray-400 text-sm">{site.domain}</p>
            </div>
            <button onClick={() => deleteSite(site.id)} className="text-red-400 text-sm hover:text-red-300">
              حذف
            </button>
          </div>
        ))}
        {sites.length === 0 && <p className="text-gray-500 text-sm">لسه مفيش مواقع مضافة.</p>}
      </div>
    </div>
  );
}
