import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api.js';
import DashboardShell from '../components/DashboardShell.jsx';
import Preloader from '../components/Preloader.jsx';
import { computeQuoteTotals, money } from '../utils/quoteMath.js';

const STATUS_OPTIONS = ['Draft', 'Sent', 'Accepted', 'Rejected', 'Expired'];
const STATUS_COLORS = {
  Draft: 'bg-gray-100 text-gray-600',
  Sent: 'bg-indigo-100 text-indigo-700',
  Accepted: 'bg-google-green/10 text-google-green',
  Rejected: 'bg-red-50 text-google-red',
  Expired: 'bg-amber-50 text-amber-700',
};

export default function QuoteView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quote, setQuote] = useState(null);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [converting, setConverting] = useState(false);

  async function load() {
    const [{ data: q }, { data: s }] = await Promise.all([
      api.get(`/quotes/${id}`),
      api.get('/invoices/settings'),
    ]);
    setQuote(q);
    setSettings(s);
  }
  useEffect(() => { setLoading(true); load().finally(() => setLoading(false)); }, [id]);

  async function handleSend() {
    if (!quote.clientEmail) return alert('Add a client email address before sending (Edit quote).');
    if (!window.confirm(`Send this quote to ${quote.clientEmail}?`)) return;
    setSending(true);
    try {
      await api.post(`/quotes/${id}/send`);
      await load();
      alert('Quote sent.');
    } catch (err) {
      alert(err?.response?.data?.error || 'Could not send quote.');
    } finally {
      setSending(false);
    }
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      const res = await api.get(`/quotes/${id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${quote.quoteNumber || 'quote'}.pdf`;
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
      await api.patch(`/quotes/${id}/status`, { status });
      load();
    } catch (err) {
      alert(err?.response?.data?.error || 'Could not update status.');
    }
  }

  async function handleConvert() {
    if (!window.confirm('Convert this quote into an invoice? This creates a new draft invoice with the same client and line items.')) return;
    setConverting(true);
    try {
      const { data } = await api.post(`/quotes/${id}/convert`);
      navigate(`/invoices/${data.invoiceId}`);
    } catch (err) {
      alert(err?.response?.data?.error || 'Could not convert quote to invoice.');
    } finally {
      setConverting(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm('Delete this quote? This cannot be undone.')) return;
    try {
      await api.delete(`/quotes/${id}`);
      navigate('/quotes');
    } catch (err) {
      alert(err?.response?.data?.error || 'Could not delete quote.');
    }
  }

  if (loading || !quote) {
    return <DashboardShell title="Quote"><Preloader label="Loading quote…" /></DashboardShell>;
  }

  const { subtotal, discountAmount, taxAmount, total } = computeQuoteTotals(quote);
  const currency = settings.currencySymbol;

  return (
    <DashboardShell
      title={`Quote ${quote.quoteNumber}`}
      subtitle={<button onClick={() => navigate('/quotes')} className="text-indigo-600 link-underline">&larr; Back to quotes</button>}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <select value={quote.status || 'Draft'} onChange={(e) => handleStatusChange(e.target.value)}
            className={`text-xs font-medium px-3 py-2 rounded-full border-0 ${STATUS_COLORS[quote.status] || 'bg-gray-100'}`}>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={() => navigate(`/quotes/${id}/edit`)} className="text-sm font-medium text-gray-500 border border-gray-200 px-3.5 py-2 rounded-full hover:border-indigo-200 hover:text-indigo-600 transition-colors">Edit</button>
          <button onClick={handleDownload} disabled={downloading} className="text-sm font-medium text-gray-500 border border-gray-200 px-3.5 py-2 rounded-full hover:border-indigo-200 hover:text-indigo-600 transition-colors disabled:opacity-60">
            {downloading ? 'Preparing…' : 'Download PDF'}
          </button>
          <button onClick={handleSend} disabled={sending} className="text-sm font-medium text-gray-500 border border-gray-200 px-3.5 py-2 rounded-full hover:border-indigo-200 hover:text-indigo-600 transition-colors disabled:opacity-60">
            {sending ? 'Sending…' : 'Send to Client'}
          </button>
          {quote.convertedInvoiceId ? (
            <button onClick={() => navigate(`/invoices/${quote.convertedInvoiceId}`)} className="bg-google-green/10 text-google-green text-sm font-medium px-4 py-2 rounded-full">
              View Invoice
            </button>
          ) : (
            <button onClick={handleConvert} disabled={converting} className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-full shadow-card btn-modern disabled:opacity-60">
              {converting ? 'Converting…' : 'Convert to Invoice'}
            </button>
          )}
          <button onClick={handleDelete} className="text-sm font-medium text-google-red px-3.5 py-2 rounded-full hover:bg-red-50 transition-colors">Delete</button>
        </div>
      }
    >
      <div className="bg-white rounded-2xl shadow-card p-8 max-w-3xl">
        <div className="flex justify-between items-start mb-8">
          <div className="flex items-start gap-3">
            {settings.companyLogo && (
              <img src={settings.companyLogo} alt="Company logo" className="w-14 h-14 object-contain rounded-lg" />
            )}
            <div>
            <p className="text-xl font-bold text-gray-900">{settings.companyName || 'Your Company'}</p>
            <p className="text-xs text-gray-500 mt-1 whitespace-pre-line">{settings.companyAddress}</p>
            <p className="text-xs text-gray-500">{settings.companyEmail}</p>
            <p className="text-xs text-gray-500">{settings.companyPhone}</p>
            {settings.companyGstin && <p className="text-xs text-gray-500">GSTIN: {settings.companyGstin}</p>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-indigo-600 tracking-wide">QUOTE</p>
            <p className="text-xs text-gray-500 mt-1">Quote #: {quote.quoteNumber}</p>
            <p className="text-xs text-gray-500">Issue Date: {quote.issueDate || '—'}</p>
            <p className="text-xs text-gray-500">Valid Until: {quote.expiryDate || '—'}</p>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4 mb-6">
          <p className="text-xs font-semibold text-gray-800 mb-1">Prepared For</p>
          <p className="text-sm text-gray-800">{quote.clientName}</p>
          <p className="text-xs text-gray-500 whitespace-pre-line">{quote.clientAddress}</p>
          <p className="text-xs text-gray-500">{quote.clientEmail}</p>
          {quote.clientGstin && <p className="text-xs text-gray-500">GSTIN: {quote.clientGstin}</p>}
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
            {(quote.lineItems || []).map((li, idx) => (
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
            {Number(quote.discountPercent) > 0 && (
              <div className="flex justify-between text-gray-500"><span>Discount ({quote.discountPercent}%)</span><span>-{money(discountAmount, currency)}</span></div>
            )}
            {Number(quote.taxPercent) > 0 && (
              <div className="flex justify-between text-gray-500"><span>Tax ({quote.taxPercent}%)</span><span>{money(taxAmount, currency)}</span></div>
            )}
            <div className="flex justify-between font-semibold text-indigo-600 text-base pt-1.5 border-t border-gray-200"><span>Total</span><span>{money(total, currency)}</span></div>
          </div>
        </div>

        {quote.notes && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-800 mb-1">Notes</p>
            <p className="text-xs text-gray-500 whitespace-pre-line">{quote.notes}</p>
          </div>
        )}
        {quote.terms && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-800 mb-1">Terms &amp; Conditions</p>
            <p className="text-xs text-gray-500 whitespace-pre-line">{quote.terms}</p>
          </div>
        )}
        {quote.sentAt && (
          <p className="text-[11px] text-gray-300 mt-6">Sent {new Date(quote.sentAt).toLocaleString()}</p>
        )}
      </div>
    </DashboardShell>
  );
}
