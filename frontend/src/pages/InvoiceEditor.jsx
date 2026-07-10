import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api.js';
import DashboardShell from '../components/DashboardShell.jsx';
import Preloader from '../components/Preloader.jsx';
import { TrashIcon } from '../components/Icons.jsx';
import { computeInvoiceTotals, money } from '../utils/invoiceMath.js';

const EMPTY_LINE = { description: '', qty: 1, rate: 0 };
const EMPTY_FORM = {
  invoiceNumber: '',
  clientName: '',
  clientEmail: '',
  clientAddress: '',
  clientGstin: '',
  issueDate: '',
  dueDate: '',
  lineItems: [{ ...EMPTY_LINE }],
  taxPercent: 0,
  discountPercent: 0,
  notes: '',
  terms: '',
};

export default function InvoiceEditor() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY_FORM);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/invoices/settings').then(({ data }) => setSettings(data));
    if (isEdit) {
      api.get(`/invoices/${id}`).then(({ data }) => {
        setForm({
          ...EMPTY_FORM,
          ...data,
          lineItems: Array.isArray(data.lineItems) && data.lineItems.length ? data.lineItems : [{ ...EMPTY_LINE }],
        });
      }).finally(() => setLoading(false));
    }
  }, [id]);

  function updateLine(idx, field, value) {
    setForm((f) => {
      const lineItems = [...f.lineItems];
      lineItems[idx] = { ...lineItems[idx], [field]: value };
      return { ...f, lineItems };
    });
  }
  function addLine() {
    setForm((f) => ({ ...f, lineItems: [...f.lineItems, { ...EMPTY_LINE }] }));
  }
  function removeLine(idx) {
    setForm((f) => ({ ...f, lineItems: f.lineItems.filter((_, i) => i !== idx) }));
  }

  const totals = computeInvoiceTotals(form);

  async function handleSave(e) {
    e.preventDefault();
    if (!form.clientName.trim()) return alert('Client name is required.');
    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/invoices/${id}`, form);
        navigate(`/invoices/${id}`);
      } else {
        const { data } = await api.post('/invoices', form);
        navigate(`/invoices/${data.id}`);
      }
    } catch (err) {
      alert(err?.response?.data?.error || 'Could not save invoice.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <DashboardShell title={isEdit ? 'Edit Invoice' : 'New Invoice'}><Preloader label="Loading…" /></DashboardShell>;
  }

  return (
    <DashboardShell
      title={isEdit ? 'Edit Invoice' : 'New Invoice'}
      subtitle={<button onClick={() => navigate('/invoices')} className="text-indigo-600 link-underline">&larr; Back to invoices</button>}
    >
      <form onSubmit={handleSave} className="bg-white rounded-2xl shadow-card p-6 max-w-3xl">
        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Invoice Number</label>
            <input placeholder="Auto-generated if left blank" value={form.invoiceNumber || ''}
              onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div />
          <div>
            <label className="block text-xs text-gray-500 mb-1">Issue Date</label>
            <input type="date" value={form.issueDate || ''} onChange={(e) => setForm({ ...form, issueDate: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Due Date</label>
            <input type="date" value={form.dueDate || ''} onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Bill To</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Client Name</label>
              <input required value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Client Email</label>
              <input type="email" value={form.clientEmail || ''} onChange={(e) => setForm({ ...form, clientEmail: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-xs text-gray-500 mb-1">Client Address</label>
            <textarea value={form.clientAddress || ''} onChange={(e) => setForm({ ...form, clientAddress: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" rows={2} />
          </div>
          <div className="mt-4">
            <label className="block text-xs text-gray-500 mb-1">Client GSTIN</label>
            <input value={form.clientGstin || ''} onChange={(e) => setForm({ ...form, clientGstin: e.target.value })}
              placeholder="e.g. 29AAAAA0000A1Z5"
              className="w-full sm:w-1/2 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Line Items</h3>
          <div className="space-y-2">
            <div className="hidden sm:grid grid-cols-[1fr_70px_100px_100px_28px] gap-2 text-xs text-gray-400 px-1">
              <span>Description</span><span>Qty</span><span>Rate</span><span>Amount</span><span />
            </div>
            {form.lineItems.map((li, idx) => (
              <div key={idx} className="grid grid-cols-2 sm:grid-cols-[1fr_70px_100px_100px_28px] gap-2 items-center">
                <input placeholder="Description" value={li.description} onChange={(e) => updateLine(idx, 'description', e.target.value)}
                  className="col-span-2 sm:col-span-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                <input type="number" min="0" step="any" value={li.qty} onChange={(e) => updateLine(idx, 'qty', e.target.value)}
                  className="border border-gray-300 rounded-lg px-2 py-2 text-sm" />
                <input type="number" min="0" step="any" value={li.rate} onChange={(e) => updateLine(idx, 'rate', e.target.value)}
                  className="border border-gray-300 rounded-lg px-2 py-2 text-sm" />
                <span className="text-sm text-gray-600 px-1">{money((Number(li.qty) || 0) * (Number(li.rate) || 0), settings.currencySymbol)}</span>
                <button type="button" onClick={() => removeLine(idx)} className="w-6 h-6 rounded-full flex items-center justify-center text-gray-300 hover:bg-red-50 hover:text-google-red">
                  <TrashIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addLine} className="mt-3 text-xs text-indigo-600 font-medium link-underline">+ Add line item</button>
        </div>

        <div className="border-t border-gray-100 pt-4 mb-4 grid sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Notes</label>
            <textarea value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" rows={3} />
            <label className="block text-xs text-gray-500 mb-1 mt-3">Terms &amp; Conditions</label>
            <textarea value={form.terms || ''} onChange={(e) => setForm({ ...form, terms: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" rows={3} />
          </div>
          <div>
            <div className="flex gap-3 mb-3">
              <div className="w-1/2">
                <label className="block text-xs text-gray-500 mb-1">Discount %</label>
                <input type="number" min="0" max="100" step="any" value={form.discountPercent}
                  onChange={(e) => setForm({ ...form, discountPercent: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="w-1/2">
                <label className="block text-xs text-gray-500 mb-1">Tax %</label>
                <input type="number" min="0" max="100" step="any" value={form.taxPercent}
                  onChange={(e) => setForm({ ...form, taxPercent: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1.5">
              <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{money(totals.subtotal, settings.currencySymbol)}</span></div>
              {Number(form.discountPercent) > 0 && (
                <div className="flex justify-between text-gray-500"><span>Discount ({form.discountPercent}%)</span><span>-{money(totals.discountAmount, settings.currencySymbol)}</span></div>
              )}
              {Number(form.taxPercent) > 0 && (
                <div className="flex justify-between text-gray-500"><span>Tax ({form.taxPercent}%)</span><span>{money(totals.taxAmount, settings.currencySymbol)}</span></div>
              )}
              <div className="flex justify-between font-semibold text-indigo-600 pt-1.5 border-t border-gray-200 text-base"><span>Total</span><span>{money(totals.total, settings.currencySymbol)}</span></div>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => navigate('/invoices')} className="py-2 px-6 rounded-full border border-gray-300 text-gray-600 hover-lift">Cancel</button>
          <button disabled={saving} className="py-2 px-6 rounded-full bg-indigo-600 text-white font-medium btn-modern disabled:opacity-60">
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Invoice'}
          </button>
        </div>
      </form>
    </DashboardShell>
  );
}
