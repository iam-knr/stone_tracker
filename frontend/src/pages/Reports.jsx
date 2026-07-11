import { useEffect, useState } from 'react';
import api from '../api.js';
import DashboardShell from '../components/DashboardShell.jsx';
import Preloader from '../components/Preloader.jsx';
import { money } from '../utils/invoiceMath.js';

const AGING_LABELS = { current: 'Current', '1-30': '1–30 days', '31-60': '31–60 days', '61-90': '61–90 days', '90+': '90+ days' };

export default function Reports() {
  const [summary, setSummary] = useState(null);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  async function load() {
    const [{ data: s }, { data: set }] = await Promise.all([
      api.get('/reports/summary'),
      api.get('/invoices/settings'),
    ]);
    setSummary(s);
    setSettings(set);
  }
  useEffect(() => { setLoading(true); load().finally(() => setLoading(false)); }, []);

  async function handleExport() {
    setDownloading(true);
    try {
      const res = await api.get('/reports/invoice-register.csv', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'invoice-register.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Could not export invoice register.');
    } finally {
      setDownloading(false);
    }
  }

  if (loading || !summary) {
    return <DashboardShell title="Reports"><Preloader label="Loading reports…" /></DashboardShell>;
  }

  const currency = settings.currencySymbol;
  const maxAging = Math.max(1, ...Object.values(summary.aging));
  const maxMonth = Math.max(1, ...summary.revenueByMonth.map((m) => m.total));

  return (
    <DashboardShell
      title="Reports"
      subtitle="Revenue, outstanding receivables, and an invoice register export for GST filing."
      actions={
        <button onClick={handleExport} disabled={downloading} className="bg-indigo-600 text-white text-sm font-medium px-4 py-2.5 rounded-full shadow-card btn-modern disabled:opacity-60">
          {downloading ? 'Preparing…' : 'Export Invoice Register (CSV)'}
        </button>
      }
    >
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl shadow-card p-5">
          <p className="text-xs text-gray-400 mb-1">Total Billed</p>
          <p className="text-xl font-semibold text-gray-800">{money(summary.totalBilled, currency)}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-card p-5">
          <p className="text-xs text-gray-400 mb-1">Total Paid</p>
          <p className="text-xl font-semibold text-google-green">{money(summary.totalPaid, currency)}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-card p-5">
          <p className="text-xs text-gray-400 mb-1">Outstanding</p>
          <p className="text-xl font-semibold text-google-red">{money(summary.totalOutstanding, currency)}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-2xl shadow-card p-6">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Aging Receivables</h3>
          <div className="space-y-3">
            {Object.entries(summary.aging).map(([key, total]) => (
              <div key={key}>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>{AGING_LABELS[key]}</span>
                  <span className="font-medium text-gray-700">{money(total, currency)}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(total / maxAging) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-card p-6">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Revenue by Month</h3>
          {summary.revenueByMonth.length === 0 ? (
            <p className="text-gray-400 text-sm">No invoices yet.</p>
          ) : (
            <div className="space-y-3">
              {summary.revenueByMonth.map((m) => (
                <div key={m.month}>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{m.month}</span>
                    <span className="font-medium text-gray-700">{money(m.total, currency)}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-google-green rounded-full" style={{ width: `${(m.total / maxMonth) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-800">Revenue by Client</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
              <th className="px-5 py-3 font-medium">Client</th>
              <th className="px-5 py-3 font-medium">Total Billed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {summary.revenueByClient.map((c) => (
              <tr key={c.clientName}>
                <td className="px-5 py-3 font-medium text-gray-800">{c.clientName}</td>
                <td className="px-5 py-3 text-gray-700">{money(c.total, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {summary.revenueByClient.length === 0 && <p className="text-gray-400 text-sm text-center p-8">No invoices yet.</p>}
      </div>
    </DashboardShell>
  );
}
