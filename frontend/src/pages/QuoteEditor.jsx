import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api.js';
import DashboardShell from '../components/DashboardShell.jsx';
import Preloader from '../components/Preloader.jsx';
import { TrashIcon } from '../components/Icons.jsx';
import CustomFieldsSection from '../components/CustomFieldsSection.jsx';
import { computeQuoteTotals, money } from '../utils/quoteMath.js';

const EMPTY_LINE = { description: '', qty: 1, rate: 0 };
const EMPTY_FORM = {
  quoteNumber: '',
  contactId: '',
  clientName: '',
  clientEmail: '',
  clientAddress: '',
  clientGstin: '',
  issueDate: '',
  expiryDate: '',
  lineItems: [{ ...EMPTY_LINE }],
  taxPercent: 0,
  discountPercent: 0,
  notes: '',
  terms: '',
};

export default function QuoteEditor() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY_FORM);
  const [settings, setSettings] = useState({});
  const [contacts, setContacts] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [savingContact, setSavingContact] = useState(false);

  useEffect(() => {
    api.get('/invoices/settings').then(({ data }) => setSettings(data));
    api.get('/contacts').then(({ data }) => setContacts(data)).catch(() => {});
    api.get('/items').then(({ data }) => setItems(data)).catch(() => {});
    if (isEdit) {
      api.get(`/quotes/${id}`).then(({ data }) => {
        setForm({
          ...EMPTY_FORM,
          ...data,
          lineItems: Array.isArray(data.lineItems) && data.lineItems.length ? data.lineItems : [{ ...EMPTY_LINE }],
        });
      }).finally(() => setLoading(false));
    }
  }, [id]);

  function handleContactSelect(e) {
    const contactId = e.target.value;
    if (!contactId) {
      setForm((f) => ({ ...f, contactId: '' }));
      return;
    }
    const c = contacts.find((c) => c.id === contactId);
    if (!c) return;
    setForm((f) => ({
      ...f,
      contactId,
      clientName: c.name || '',
      clientEmail: c.email || '',
      clientAddress: c.address || '',
      clientGstin: c.gstin || '',
    }));
  }

  async function handleSaveAsContact() {
    if (!form.clientName.trim()) return alert('Enter a client name first.');
    setSavingContact(true);
    try {
      const { data } = await api.post('/contacts', {
        name: form.clientName,
        email: form.clientEmail,
        address: form.clientAddress,
        gstin: form.clientGstin,
      });
      const { data: refreshed } = await api.get('/contacts');
      setContacts(refreshed);
      setForm((f) => ({ ...f, contactId: data.id }));
    } catch (err) {
      alert(err?.response?.data?.error || 'Could not save contact.');
    } finally {
      setSavingContact(false);
    }
  }

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
  function handleInsertItem(e) {
    const itemId = e.target.value;
    if (!itemId) return;
    const it = items.find((i) => i.id === itemId);
    if (!it) return;
    setForm((f) => ({
      ...f,
      lineItems: [...f.lineItems, { description: it.description, qty: 1, rate: Number(it.rate) || 0 }],
    }));
    e.target.value = '';
  }

  const totals = computeQuoteTotals(form);

  async function handleSave(e) {
    e.preventDefault();
    if (!form.clientName.trim()) return alert('Client name is required.');
    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/quotes/${id}`, form);
        navigate(`/quotes/${id}`);
      } else {
        const { data } = await api.post('/quotes', form);
        navigate(`/quotes/${data.id}`);
      }
    } catch (err) {
      alert(err?.response?.data?.error || 'Could not save quote.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <DashboardShell title={isEdit ? 'Edit Quote' : 'New Quote'}><Preloader label="Loading…" /></DashboardShell>;
  }

  return (
    <DashboardShell
      title={isEdit ? 'Edit Quote' : 'New Quote'}
      subtitle={<button onClick={() => navigate('/quotes')} className="text-indigo-600 link-underline">&larr; Back to quotes</button>}
    >
      <form onSubmit={handleSave} className="bg-white rounded-2xl shadow-card p-6 max-w-3xl">
        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Quote Number</label>
            <input placeholder="Auto-generated if left blank" value={form.quoteNumber || ''}
              onChange={(e) => setForm({ ...form, quoteNumber: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div />
          <div>
            <label className="block text-xs text-gray-500 mb-1">Issue Date</label>
            <input type="date" value={form.issueDate || ''} onChange={(e) => setForm({ ...form, issueDate: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Valid Until</label>
            <input type="date" value={form.expiryDate || ''} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Prepared For</h3>
          <div className="mb-4">
            <label className="block text-xs text-gray-500 mb-1">Contact</label>
            <select value={form.contactId || ''} onChange={handleContactSelect}
              className="w-full sm:w-1/2 border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">+ New / one-off client (not saved to Contacts)</option>
              {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1 flex items-center justify-between">
                <span>Client Name</span>
                {!form.contactId && (
                  <button type="button" onClick={handleSaveAsContact} disabled={savingContact} className="text-indigo-600 font-medium normal-case text-[11px] disabled:opacity-60">
                    {savingContact ? 'Saving…' : '+ Save as contact'}
                  </button>
                )}
              </label>
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
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">Line Items</h3>
            {items.length > 0 && (
              <select defaultValue="" onChange={handleInsertItem} className="text-xs border border-gray-300 rounded-lg px-2 py-1.5">
                <option value="">+ Insert from catalog…</option>
                {items.map((it) => <option key={it.id} value={it.id}>{it.description}</option>)}
              </select>
            )}
          </div>
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

        <CustomFieldsSection appliesTo="quote" values={form.customFields} onChange={(customFields) => setForm({ ...form, customFields })} />

        <div className="flex gap-3 mt-4">
          <button type="button" onClick={() => navigate('/quotes')} className="py-2 px-6 rounded-full border border-gray-300 text-gray-600 hover-lift">Cancel</button>
          <button disabled={saving} className="py-2 px-6 rounded-full bg-indigo-600 text-white font-medium btn-modern disabled:opacity-60">
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Quote'}
          </button>
        </div>
      </form>
    </DashboardShell>
  );
}
