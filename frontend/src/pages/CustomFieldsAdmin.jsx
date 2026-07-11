import { useEffect, useState } from 'react';
import api from '../api.js';
import DashboardShell from '../components/DashboardShell.jsx';
import Preloader from '../components/Preloader.jsx';

const APPLIES_TO_LABELS = { invoice: 'Invoices', contact: 'Contacts', quote: 'Quotes' };
const EMPTY_FORM = { label: '', appliesTo: 'invoice', fieldType: 'text', required: false, sortOrder: 0 };

function FieldModal({ initial, onClose, onSaved }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const isEdit = !!initial?.id;

  async function handleSave(e) {
    e.preventDefault();
    if (!form.label.trim()) return alert('Field label is required.');
    setSaving(true);
    try {
      if (isEdit) await api.put(`/custom-field-defs/${initial.id}`, form);
      else await api.post('/custom-field-defs', form);
      onSaved();
      onClose();
    } catch (err) {
      alert(err?.response?.data?.error || 'Could not save field.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-30 animate-fade-in">
      <form onSubmit={handleSave} className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-medium mb-4">{isEdit ? 'Edit Field' : 'New Custom Field'}</h2>
        <label className="block text-xs text-gray-500 mb-1">Label</label>
        <input required value={form.label || ''} onChange={(e) => setForm({ ...form, label: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3 text-sm" />
        <label className="block text-xs text-gray-500 mb-1">Applies To</label>
        <select value={form.appliesTo} onChange={(e) => setForm({ ...form, appliesTo: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3 text-sm">
          <option value="invoice">Invoices</option>
          <option value="contact">Contacts</option>
          <option value="quote">Quotes</option>
        </select>
        <label className="block text-xs text-gray-500 mb-1">Field Type</label>
        <select value={form.fieldType} onChange={(e) => setForm({ ...form, fieldType: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3 text-sm">
          <option value="text">Text</option>
          <option value="number">Number</option>
          <option value="date">Date</option>
        </select>
        <label className="flex items-center gap-2 mb-3 text-sm text-gray-700">
          <input type="checkbox" checked={!!form.required} onChange={(e) => setForm({ ...form, required: e.target.checked })} />
          Required
        </label>
        <label className="block text-xs text-gray-500 mb-1">Sort Order</label>
        <input type="number" value={form.sortOrder ?? 0} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 text-sm" />
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="w-1/2 py-2 rounded-full border border-gray-300 text-gray-600 hover-lift">Cancel</button>
          <button disabled={saving} className="w-1/2 py-2 rounded-full bg-indigo-600 text-white font-medium btn-modern disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}

export default function CustomFieldsAdmin() {
  const [defs, setDefs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  async function load() {
    const { data } = await api.get('/custom-field-defs');
    setDefs(data);
  }
  useEffect(() => { setLoading(true); load().finally(() => setLoading(false)); }, []);

  async function handleDelete(id) {
    if (!window.confirm('Delete this custom field? Existing values already saved on records are kept but the field will no longer appear on forms.')) return;
    try {
      await api.delete(`/custom-field-defs/${id}`);
      load();
    } catch (err) {
      alert(err?.response?.data?.error || 'Could not delete field.');
    }
  }

  const sorted = [...defs].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  return (
    <DashboardShell
      title="Custom Fields"
      subtitle="Define extra fields shown on Invoice, Quote, and Contact forms."
      actions={
        <button onClick={() => { setEditing(null); setShowModal(true); }} className="bg-indigo-600 text-white text-sm font-medium px-4 py-2.5 rounded-full shadow-card btn-modern flex items-center gap-2">
          <span className="text-lg leading-none">+</span> New Field
        </button>
      }
    >
      {loading ? (
        <Preloader label="Loading custom fields…" />
      ) : (
        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="px-5 py-3 font-medium">Label</th>
                <th className="px-5 py-3 font-medium">Applies To</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Required</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 animate-stagger">
              {sorted.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-medium text-gray-800">{d.label}</td>
                  <td className="px-5 py-3 text-gray-500">{APPLIES_TO_LABELS[d.appliesTo] || d.appliesTo}</td>
                  <td className="px-5 py-3 text-gray-500 capitalize">{d.fieldType}</td>
                  <td className="px-5 py-3 text-gray-500">{d.required ? 'Yes' : 'No'}</td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    <button onClick={() => { setEditing(d); setShowModal(true); }} className="text-xs text-indigo-600 font-medium link-underline mr-3">Edit</button>
                    <button onClick={() => handleDelete(d.id)} className="text-xs text-google-red font-medium link-underline">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sorted.length === 0 && <p className="text-gray-400 text-sm text-center p-8">No custom fields yet. Add one to appear on Invoice, Quote, or Contact forms.</p>}
        </div>
      )}

      {showModal && (
        <FieldModal initial={editing} onClose={() => setShowModal(false)} onSaved={load} />
      )}
    </DashboardShell>
  );
}
