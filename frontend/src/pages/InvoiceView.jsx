import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api.js';
import DashboardShell from '../components/DashboardShell.jsx';
import Preloader from '../components/Preloader.jsx';
import { computeInvoiceTotals, money } from '../utils/invoiceMath.js';

const STATUS_OPTIONS = ['Draft', 'Sent', 'Paid', 'Overdue'];
const STATUS_COLORS = {
  Draft: 'bg-gray-100 text-gray-600',
  Sent: 'bg-indigo-100 text-indigo-700',
  Paid: 'bg-google-green/10 text-google-green',
  Overdue: 'bg-red-50 text-google-red',
};

export default function InvoiceView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [downloading, setDownloading] = useState(false);

  async function load() {
    const [{ data: inv }, { data: s }] = await Promise.all([
      api.get(`/invoices/${id}`),
      api.get('/invoices/settings'),
    ]);
    setInvoice(inv);
    setSettings(s);
  }
  useEffect(() => { setLoading(true); load().finally(() => setLoading(false)); }, [id]);

  async function handleSend() {
    if (!invoice.clientEmail) return alert('Add a client email address before sending (Edit invoice).');
    if (!window.confirm(`Send this invoice to ${invoice.clientEmail}?`)) return;
    setSending(true);
    try {
      await api.post(`/invoices/${id}/send`);
      await load();
      alert('Invoice sent.');
    } catch (err) {
      alert(err?.response?.data?.error || 'Could not send invoice.');
    } finally {
      setSending(false);
    }
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      const res = await api.get(`/invoices/${id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoice.invoiceNumber || 'invoice'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Could not download PDF.');
    } finally {
      setDownloading(false);
    }
  }

  async function handleStatusChange(status) {
    try {
      await api.patch(`/invoices/${id}/status`, { status });
      load();
    } catch (err) {
      alert(err?.response?.data?.error || 'Could not update status.');
    }
  }

  async function handleDelete() {
    if (!window.confirm('Delete this invoice? This cannot be undone.')) return;
    try {
      await api.delete(`/invoices/${id}`);
      navigate('/invoices');
    } catch (err) {
      alert(err?.response?.data?.error || 'Could not delete invoice.');
    }
  }

  if (loading || !invoice) {
    return <DashboardShell title="Invoice"><Preloader label="Loading invoice…" /></DashboardShell>;
  }

  const { subtotal, discountAmount, taxAmount, total } = computeInvoiceTotals(invoice);
  const currency = settings.currencySymbol;

  return (
    <DashboardShell
      title={`Invoice ${invoice.invoiceNumber}`}
      subtitle={<button onClick={() => navigate('/invoices')} className="text-indigo-600 link-underline">&larr; Back to invoices</button>}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <select value={invoice.status || 'Draft'} onChange={(e) => handleStatusChange(e.target.value)}
            className={`text-xs font-medium px-3 py-2 rounded-full border-0 ${STATUS_COLORS[invoice.status] || 'bg-gray-100'}`}>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={() => navigate(`/invoices/${id}/edit`)} className="text-sm font-medium text-gray-500 border border-gray-200 px-3.5 py-2 rounded-full hover:border-indigo-200 hover:text-indigo-600 transition-colors">Edit</button>
          <button onClick={handleDownload} disabled={downloading} className="text-sm font-medium text-gray-500 border border-gray-200 px-3.5 py-2 rounded-full hover:border-indigo-200 hover:text-indigo-600 transition-colors disabled:opacity-60">
            {downloading ? 'Preparing…' : 'Download PDF'}
          </button>
          <button onClick={handleSend} disabled={sending} className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-full shadow-card btn-modern disabled:opacity-60">
            {sending ? 'Sending…' : 'Send to Client'}
          </button>
          <button onClick={handleDelete} className="text-sm font-medium text-google-red px-3.5 py-2 rounded-full hover:bg-red-50 transition-colors">Delete</button>
        </div>
      }
    >
      <div className="bg-white rounded-2xl shadow-card p-8 max-w-3xl">
        <div className="flex justify-between items-start mb-8">
          <div>
            <p className="text-xl font-bold text-gray-900">{settings.companyName || 'Your Company'}</p>
            <p className="text-xs text-gray-500 mt-1 whitespace-pre-line">{settings.companyAddress}</p>
            <p className="text-xs text-gray-500">{settings.companyEmail}</p>
            <p className="text-xs text-gray-500">{settings.companyPhone}</p>
            {settings.companyGstin && <p className="text-xs text-gray-500">GSTIN: {settings.companyGstin}</p>}
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-indigo-600 tracking-wide">INVOICE</p>
            <p className="text-xs text-gray-500 mt-1">Invoice #: {invoice.invoiceNumber}</p>
            <p className="text-xs text-gray-500">Issue Date: {invoice.issueDate || '—'}</p>
            <p className="text-xs text-gray-500">Due Date: {invoice.dueDate || '—'}</p>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4 mb-6">
          <p className="text-xs font-semibold text-gray-800 mb-1">Bill To</p>
          <p className="text-sm text-gray-800">{invoice.clientName}</p>
          <p className="text-xs text-gray-500 whitespace-pre-line">{invoice.clientAddress}</p>
          <p className="text-xs text-gray-500">{invoice.clientEmail}</p>
          {invoice.clientGstin && <p className="text-xs text-gray-500">GSTIN: {invoice.clientGstin}</p>}
        </div>

        <table className="w-full text-sm mb-6">
          <thead>
            <tr className="bg-indigo-600 text-white text-xs">
              <th className="text-left font-medium px-3 py-2 rounded-l-md">Description</th>
              <th className="text-right font-medium px-3 py-2">Qty</th>
              <th className="text-right font-medium px-3 py-2">Rate</th>
              <th className="text-right font-medium px-3 py-2 rounded-r-md">Amount</th>
            </tr>
          </thead>
          <tbody>
            {(invoice.lineItems || []).map((li, idx) => (
              <tr key={idx} className={idx % 2 === 1 ? 'bg-gray-50' : ''}>
                <td className="px-3 py-2">{li.description}</td>
                <td className="px-3 py-2 text-right">{li.qty}</td>
                <td className="px-3 py-2 text-right">{money(li.rate, currency)}</td>
                <td className="px-3 py-2 text-right">{money((Number(li.qty) || 0) * (Number(li.rate) || 0), currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end mb-6">
          <div className="w-56 space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{money(subtotal, currency)}</span></div>
            {Number(invoice.discountPercent) > 0 && (
              <div className="flex justify-between text-gray-500"><span>Discount ({invoice.discountPercent}%)</span><span>-{money(discountAmount, currency)}</span></div>
            )}
            {Number(invoice.taxPercent) > 0 && (
              <div className="flex justify-between text-gray-500"><span>Tax ({invoice.taxPercent}%)</span><span>{money(taxAmount, currency)}</span></div>
            )}
            <div className="flex justify-between font-semibold text-indigo-600 text-base pt-1.5 border-t border-gray-200"><span>Total</span><span>{money(total, currency)}</span></div>
          </div>
        </div>

        {invoice.notes && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-800 mb-1">Notes</p>
            <p className="text-xs text-gray-500 whitespace-pre-line">{invoice.notes}</p>
          </div>
        )}
        {invoice.terms && (
          <div>
            <p className="text-xs font-semibold text-gray-800 mb-1">Terms &amp; Conditions</p>
            <p className="text-xs text-gray-500 whitespace-pre-line">{invoice.terms}</p>
          </div>
        )}
        {invoice.sentAt && (
          <p className="text-[11px] text-gray-300 mt-6">Sent {new Date(invoice.sentAt).toLocaleString()}</p>
        )}
      </div>
    </DashboardShell>
  );
}
