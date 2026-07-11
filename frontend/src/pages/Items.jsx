import { useEffect, useState } from 'react';
import api from '../api.js';
import DashboardShell from '../components/DashboardShell.jsx';
import Preloader from '../components/Preloader.jsx';
import { money } from '../utils/invoiceMath.js';

const EMPTY_FORM = { description: '', sku: '', rate: 0, taxPercent: '' };

function ItemModal({ initial, onClose, onSaved }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const isEdit = !!initial?.id;

  async function handleSave(e) {
    e.preventDefault();
    if (!form.description.trim()) return alert('Item description is required.');
    setSaving(true);
    try {
      if (isEdit) await api.put(`/items/${initial.id}`, form);
      else await api.post('/items', form);
      onSaved();
      onClose();
    } catch (err) {
      alert(err?.response?.data?.error || 'Could not save item.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-30 animate-fade-in">
      <form onSubmit={handleSave} className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-medium mb-4">{isEdit ? 'Edit Item' : 'New Item'}</h2>
        <label className="block text-xs text-gray-500 mb-1">Description</label>
        <input required value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3 text-sm" />
        <label className="block text-xs text-gray-500 mb-1">SKU / Code</label>
        <input value={form.sku || ''} onChange={(e) => setForm({ ...form, sku: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3 text-sm" />
        <label className="block text-xs text-gray-500 mb-1">Default Rate</label>
        <input type="number" min="0" step="any" value={form.rate ?? 0} onChange={(e) => setForm({ ...form, rate: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3 text-sm" />
        <label className="block text-xs text-gray-500 mb-1">Default Tax % (optional)</label>
        <input type="number" min="0" max="100" step="any" value={form.taxPercent ?? ''} onChange={(e) => setForm({ ...form, taxPercent: e.target.value })}
          placeholder="Leave blank to use invoice-level tax"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 text-sm" />
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="w-1/2 py-2 rounded-full border border-gray-300 text-gray-600 hover-lift">Cancel</button>
          <button disabled={saving} className="w-1/2 py-2 rounded-full bg-indigo-600 text-white font-medium btn-modern disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}

export default function Items() {
  const [items, setItems] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  async function load() {
    const [{ data: i }, { data: s }] = await Promise.all([
      api.get('/items'),
      api.get('/invoices/settings'),
    ]);
    setItems(i);
    setSettings(s);
  }
  useEffect(() => { setLoading(true); load().finally(() => setLoading(false)); }, []);

  async function handleDelete(id) {
    if (!window.confirm('Delete this item from the catalog?')) return;
    try {
      await api.delete(`/items/${id}`);
      load();
    } catch (err) {
      alert(err?.response?.data?.error || 'Could not delete item.');
    }
  }

  const sorted = [...items].sort((a, b) => (a.description || '').localeCompare(b.description || ''));

  return (
    <DashboardShell
      title="Item Catalog"
      subtitle="Save reusable line items so you don't retype descriptions and rates on every invoice or quote."
      actions={
        <button onClick={() => { setEditing(null); setShowModal(true); }} className="bg-indigo-600 text-white text-sm font-medium px-4 py-2.5 rounded-full shadow-card btn-modern flex items-center gap-2">
          <span className="text-lg leading-none">+</span> New Item
        </button>
      }
    >
      {loading ? (
        <Preloader label="Loading items…" />
      ) : (
        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="px-5 py-3 font-medium">Description</th>
                <th className="px-5 py-3 font-medium">SKU</th>
                <th className="px-5 py-3 font-medium">Rate</th>
                <th className="px-5 py-3 font-medium">Tax %</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 animate-stagger">
              {sorted.map((it) => (
                <tr key={it.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-medium text-gray-800">{it.description}</td>
                  <td className="px-5 py-3 text-gray-500">{it.sku || '—'}</td>
                  <td className="px-5 py-3 text-gray-700">{money(it.rate, settings.currencySymbol)}</td>
                  <td className="px-5 py-3 text-gray-500">{it.taxPercent != null && it.taxPercent !== '' ? `${it.taxPercent}%` : '—'}</td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    <button onClick={() => { setEditing(it); setShowModal(true); }} className="text-xs text-indigo-600 font-medium link-underline mr-3">Edit</button>
                    <button onClick={() => handleDelete(it.id)} className="text-xs text-google-red font-medium link-underline">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sorted.length === 0 && <p className="text-gray-400 text-sm text-center p-8">No items yet. Add your first reusable line item.</p>}
        </div>
      )}

      {showModal && (
        <ItemModal initial={editing} onClose={() => setShowModal(false)} onSaved={load} />
      )}
    </DashboardShell>
  );
}
