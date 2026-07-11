import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api.js';
import DashboardShell from '../components/DashboardShell.jsx';
import Preloader from '../components/Preloader.jsx';
import { computeQuoteTotals, money } from '../utils/quoteMath.js';

const STATUS_COLORS = {
  Draft: 'bg-gray-100 text-gray-600',
  Sent: 'bg-indigo-100 text-indigo-700',
  Accepted: 'bg-google-green/10 text-google-green',
  Rejected: 'bg-red-50 text-google-red',
  Expired: 'bg-amber-50 text-amber-700',
};

export default function Quotes() {
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);

  async function load() {
    const [{ data: q }, { data: s }] = await Promise.all([
      api.get('/quotes'),
      api.get('/invoices/settings'),
    ]);
    setQuotes(q);
    setSettings(s);
  }
  useEffect(() => { setLoading(true); load().finally(() => setLoading(false)); }, []);

  const sorted = [...quotes].sort((a, b) => Number(b.id) - Number(a.id));

  return (
    <DashboardShell
      title="Quotes"
      subtitle="Send pre-invoice estimates, then convert accepted ones to invoices in one click."
      actions={
        <button onClick={() => navigate('/quotes/new')} className="bg-indigo-600 text-white text-sm font-medium px-4 py-2.5 rounded-full shadow-card btn-modern flex items-center gap-2">
          <span className="text-lg leading-none">+</span> New Quote
        </button>
      }
    >
      {loading ? (
        <Preloader label="Loading quotes…" />
      ) : (
        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="px-5 py-3 font-medium">Quote #</th>
                <th className="px-5 py-3 font-medium">Client</th>
                <th className="px-5 py-3 font-medium">Total</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Valid Until</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 animate-stagger">
              {sorted.map((q) => {
                const { total } = computeQuoteTotals(q);
                return (
                  <tr key={q.id} onClick={() => navigate(`/quotes/${q.id}`)} className="cursor-pointer hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-800">{q.quoteNumber}</td>
                    <td className="px-5 py-3 text-gray-500">{q.clientName}</td>
                    <td className="px-5 py-3 text-gray-700 font-medium">{money(total, settings.currencySymbol)}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_COLORS[q.status] || 'bg-gray-100'}`}>{q.status || 'Draft'}</span>
                    </td>
                    <td className="px-5 py-3 text-gray-500">{q.expiryDate || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {sorted.length === 0 && <p className="text-gray-400 text-sm text-center p-8">No quotes yet. Create your first one.</p>}
        </div>
      )}
    </DashboardShell>
  );
}
