import { useEffect, useState } from 'react';
import api from '../api.js';
import { TrashIcon } from '../components/Icons.jsx';
import { computeInvoiceTotals, money } from '../utils/invoiceMath.js';

const EMPTY_LINE = { description: '', qty: 1, rate: 0 };
const EMPTY_FORM = {
  contactId: '',
  clientName: '',
  clientEmail: '',
  clientAddress: '',
  clientGstin: '',
  lineItems: [{ ...EMPTY_LINE }],
  taxPercent: 0,
  discountPercent: 0,
  notes: '',
  terms: '',
  frequency: 'Monthly',
  startDate: '',
  dueInDays: 15,
};

const FREQUENCY_LABELS = {
  Weekly: 'Weekly',
  Monthly: 'Monthly',
  Quarterly: 'Quarterly',
  Yearly: 'Yearly',
};

const STATUS_COLORS = {
  Active: 'bg-google-green/10 text-google-green',
  Paused: 'bg-yellow-50 text-yellow-700',
  Cancelled: 'bg-gray-100 text-gray-500',
};

function RecurringInvoiceModal({ initial, contacts, items, settings, onClose, onSaved }) {
  const isEdit = !!initial?.id;
  const [form, setForm] = useState({ ...EMPTY_FORM, ...initial });
  const [saving, setSaving] = useState(false);

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

  const totals = computeInvoiceTotals(form);

  async function handleSave(e) {
    e.preventDefault();
    if (!form.clientName.trim()) return alert('Client name is required.');
    if (!isEdit && !form.startDate) return alert('Start date is required.');
    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/recurring-invoices/${initial.id}`, form);
      } else {
        await api.post('/recurring-invoices', form);
      }
      onSaved();
      onClose();
    } catch (err) {
      alert(err?.response?.data?.error || 'Could not save recurring invoice.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-30 animate-fade-in p-0 sm:p-4">
      <form onSubmit={handleSave} className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-medium mb-1">{isEdit ? 'Edit Recurring Invoice' : 'New Recurring Invoice'}</h2>
        <p className="text-xs text-gray-400 mb-4">Automatically creates a Draft invoice on schedule — you review and send it yourself.</p>

        <div className="grid sm:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Frequency</label>
            <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {Object.entries(FREQUENCY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{isEdit ? 'Next Run Date' : 'Start Date'}</label>
            <input type="date" disabled={isEdit} value={isEdit ? (initial.nextRunDate || '') : form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400" />
            {isEdit && <p className="text-[11px] text-gray-400 mt-1">Pause/cancel below to change scheduling.</p>}
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Due In (days)</label>
            <input type="number" min="0" value={form.dueInDays}
              onChange={(e) => setForm({ ...form, dueInDays: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Bill To</h3>
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
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" rows={2} />
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
            <div className="bg-gray-50 rounded-xl p-3 text-sm flex justify-between font-semibold text-indigo-600">
              <span>Total per invoice</span><span>{money(totals.total, settings.currencySymbol)}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-4">
          <button type="button" onClick={onClose} className="w-1/2 py-2 rounded-full border border-gray-300 text-gray-600 hover-lift">Cancel</button>
          <button disabled={saving} className="w-1/2 py-2 rounded-full bg-indigo-600 text-white font-medium btn-modern disabled:opacity-60">
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Recurring Invoice'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function RecurringInvoicesPanel({ settings }) {
  const [series, setSeries] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null = closed, {} = new, {...row} = edit
  const [busyId, setBusyId] = useState(null);

  async function load() {
    const [{ data: rows }, { data: c }, { data: it }] = await Promise.all([
      api.get('/recurring-invoices'),
      api.get('/contacts').catch(() => ({ data: [] })),
      api.get('/items').catch(() => ({ data: [] })),
    ]);
    setSeries(rows);
    setContacts(c);
    setItems(it);
  }
  useEffect(() => { setLoading(true); load().finally(() => setLoading(false)); }, []);

  async function handleStatusChange(id, status) {
    setBusyId(id);
    try {
      await api.patch(`/recurring-invoices/${id}/status`, { status });
      await load();
    } catch (err) {
      alert(err?.response?.data?.error || 'Could not update status.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id, clientName) {
    if (!window.confirm(`Delete the recurring invoice series for "${clientName}"? This cannot be undone.`)) return;
    setBusyId(id);
    try {
      await api.delete(`/recurring-invoices/${id}`);
      await load();
    } catch (err) {
      alert(err?.response?.data?.error || 'Could not delete recurring invoice.');
    } finally {
      setBusyId(null);
    }
  }

  const sorted = [...series].sort((a, b) => Number(b.id) - Number(a.id));

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => setEditing({})} className="bg-indigo-600 text-white text-sm font-medium px-4 py-2.5 rounded-full shadow-card btn-modern flex items-center gap-2">
          <span className="text-lg leading-none">+</span> New Recurring Invoice
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm text-center p-8">Loading…</p>
      ) : (
        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="px-5 py-3 font-medium">Client</th>
                <th className="px-5 py-3 font-medium">Frequency</th>
                <th className="px-5 py-3 font-medium">Total</th>
                <th className="px-5 py-3 font-medium">Next Run</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sorted.map((s) => {
                const { total } = computeInvoiceTotals(s);
                return (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-800 cursor-pointer" onClick={() => setEditing(s)}>{s.clientName}</td>
                    <td className="px-5 py-3 text-gray-500">{FREQUENCY_LABELS[s.frequency] || s.frequency}</td>
                    <td className="px-5 py-3 text-gray-700 font-medium">{money(total, settings.currencySymbol)}</td>
                    <td className="px-5 py-3 text-gray-500">{s.status === 'Active' ? (s.nextRunDate || '—') : '—'}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_COLORS[s.status] || 'bg-gray-100'}`}>{s.status}</span>
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      {s.status === 'Active' && (
                        <button disabled={busyId === s.id} onClick={() => handleStatusChange(s.id, 'Paused')} className="text-xs text-gray-500 font-medium link-underline mr-3 disabled:opacity-50">Pause</button>
                      )}
                      {s.status === 'Paused' && (
                        <button disabled={busyId === s.id} onClick={() => handleStatusChange(s.id, 'Active')} className="text-xs text-indigo-600 font-medium link-underline mr-3 disabled:opacity-50">Resume</button>
                      )}
                      {s.status !== 'Cancelled' && (
                        <button disabled={busyId === s.id} onClick={() => handleStatusChange(s.id, 'Cancelled')} className="text-xs text-gray-500 font-medium link-underline mr-3 disabled:opacity-50">Cancel</button>
                      )}
                      <button disabled={busyId === s.id} onClick={() => handleDelete(s.id, s.clientName)} className="text-xs text-google-red font-medium link-underline disabled:opacity-50">Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {sorted.length === 0 && <p className="text-gray-400 text-sm text-center p-8">No recurring invoices yet. Set one up for a retainer or repeat client.</p>}
        </div>
      )}

      {editing !== null && (
        <RecurringInvoiceModal
          initial={editing}
          contacts={contacts}
          items={items}
          settings={settings}
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
