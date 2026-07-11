import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api.js';
import DashboardShell from '../components/DashboardShell.jsx';
import Preloader from '../components/Preloader.jsx';
import { money } from '../utils/invoiceMath.js';

const STATUS_COLORS = {
  Draft: 'bg-gray-100 text-gray-600',
  Sent: 'bg-indigo-100 text-indigo-700',
  Paid: 'bg-google-green/10 text-google-green',
  Overdue: 'bg-red-50 text-google-red',
};

export default function ContactView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [statement, setStatement] = useState(null);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);

  async function load() {
    const [{ data: st }, { data: s }] = await Promise.all([
      api.get(`/contacts/${id}/statement`),
      api.get('/invoices/settings'),
    ]);
    setStatement(st);
    setSettings(s);
  }
  useEffect(() => { setLoading(true); load().finally(() => setLoading(false)); }, [id]);

  if (loading || !statement) {
    return <DashboardShell title="Contact"><Preloader label="Loading statement…" /></DashboardShell>;
  }

  const { contact, invoices, totals } = statement;
  const currency = settings.currencySymbol;

  return (
    <DashboardShell
      title={contact.name}
      subtitle={<button onClick={() => navigate('/contacts')} className="text-indigo-600 link-underline">&larr; Back to contacts</button>}
    >
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl shadow-card p-5">
          <p className="text-xs text-gray-400 mb-1">Total Billed</p>
          <p className="text-xl font-semibold text-gray-800">{money(totals.billed, currency)}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-card p-5">
          <p className="text-xs text-gray-400 mb-1">Total Paid</p>
          <p className="text-xl font-semibold text-google-green">{money(totals.paid, currency)}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-card p-5">
          <p className="text-xs text-gray-400 mb-1">Outstanding</p>
          <p className="text-xl font-semibold text-google-red">{money(totals.outstanding, currency)}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card p-6 mb-6">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">Contact Details</h3>
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <p><span className="text-gray-400">Email:</span> {contact.email || '—'}</p>
          <p><span className="text-gray-400">Phone:</span> {contact.phone || '—'}</p>
          <p><span className="text-gray-400">GSTIN:</span> {contact.gstin || '—'}</p>
          <p className="sm:col-span-2 whitespace-pre-line"><span className="text-gray-400">Address:</span> {contact.address || '—'}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-800">Invoices</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
              <th className="px-5 py-3 font-medium">Invoice #</th>
              <th className="px-5 py-3 font-medium">Issue Date</th>
              <th className="px-5 py-3 font-medium">Due Date</th>
              <th className="px-5 py-3 font-medium">Total</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {invoices.map((inv) => (
              <tr key={inv.id} onClick={() => navigate(`/invoices/${inv.id}`)} className="cursor-pointer hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3 font-medium text-gray-800">{inv.invoiceNumber}</td>
                <td className="px-5 py-3 text-gray-500">{inv.issueDate || '—'}</td>
                <td className="px-5 py-3 text-gray-500">{inv.dueDate || '—'}</td>
                <td className="px-5 py-3 text-gray-700 font-medium">{money(inv.total, currency)}</td>
                <td className="px-5 py-3">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_COLORS[inv.status] || 'bg-gray-100'}`}>{inv.status || 'Draft'}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {invoices.length === 0 && <p className="text-gray-400 text-sm text-center p-8">No invoices for this contact yet.</p>}
      </div>
    </DashboardShell>
  );
}
