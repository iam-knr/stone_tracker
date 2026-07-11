import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api.js';
import DashboardShell from '../components/DashboardShell.jsx';
import Preloader from '../components/Preloader.jsx';

const EMPTY_FORM = { name: '', email: '', phone: '', address: '', gstin: '', notes: '' };

function ContactModal({ initial, onClose, onSaved }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const isEdit = !!initial?.id;

  async function handleSave(e) {
    e.preventDefault();
    if (!form.name.trim()) return alert('Contact name is required.');
    setSaving(true);
    try {
      if (isEdit) await api.put(`/contacts/${initial.id}`, form);
      else await api.post('/contacts', form);
      onSaved();
      onClose();
    } catch (err) {
      alert(err?.response?.data?.error || 'Could not save contact.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-30 animate-fade-in">
      <form onSubmit={handleSave} className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-medium mb-4">{isEdit ? 'Edit Contact' : 'New Contact'}</h2>
        <label className="block text-xs text-gray-500 mb-1">Name</label>
        <input required value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3 text-sm" />
        <label className="block text-xs text-gray-500 mb-1">Email</label>
        <input type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3 text-sm" />
        <label className="block text-xs text-gray-500 mb-1">Phone</label>
        <input value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3 text-sm" />
        <label className="block text-xs text-gray-500 mb-1">Address</label>
        <textarea value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3 text-sm" rows={2} />
        <label className="block text-xs text-gray-500 mb-1">GSTIN</label>
        <input value={form.gstin || ''} onChange={(e) => setForm({ ...form, gstin: e.target.value })}
          placeholder="e.g. 29AAAAA0000A1Z5"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3 text-sm" />
        <label className="block text-xs text-gray-500 mb-1">Notes</label>
        <textarea value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 text-sm" rows={2} />
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="w-1/2 py-2 rounded-full border border-gray-300 text-gray-600 hover-lift">Cancel</button>
          <button disabled={saving} className="w-1/2 py-2 rounded-full bg-indigo-600 text-white font-medium btn-modern disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}

export default function Contacts() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  async function load() {
    const { data } = await api.get('/contacts');
    setContacts(data);
  }
  useEffect(() => { setLoading(true); load().finally(() => setLoading(false)); }, []);

  const sorted = [...contacts].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  return (
    <DashboardShell
      title="Contacts"
      subtitle="Clients you bill — saved once, reused on every invoice and quote."
      actions={
        <button onClick={() => { setEditing(null); setShowModal(true); }} className="bg-indigo-600 text-white text-sm font-medium px-4 py-2.5 rounded-full shadow-card btn-modern flex items-center gap-2">
          <span className="text-lg leading-none">+</span> New Contact
        </button>
      }
    >
      {loading ? (
        <Preloader label="Loading contacts…" />
      ) : (
        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Phone</th>
                <th className="px-5 py-3 font-medium">GSTIN</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 animate-stagger">
              {sorted.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-medium text-gray-800 cursor-pointer" onClick={() => navigate(`/contacts/${c.id}`)}>{c.name}</td>
                  <td className="px-5 py-3 text-gray-500 cursor-pointer" onClick={() => navigate(`/contacts/${c.id}`)}>{c.email || '—'}</td>
                  <td className="px-5 py-3 text-gray-500 cursor-pointer" onClick={() => navigate(`/contacts/${c.id}`)}>{c.phone || '—'}</td>
                  <td className="px-5 py-3 text-gray-500 cursor-pointer" onClick={() => navigate(`/contacts/${c.id}`)}>{c.gstin || '—'}</td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => { setEditing(c); setShowModal(true); }} className="text-xs text-indigo-600 font-medium link-underline">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sorted.length === 0 && <p className="text-gray-400 text-sm text-center p-8">No contacts yet. Add your first client.</p>}
        </div>
      )}

      {showModal && (
        <ContactModal initial={editing} onClose={() => setShowModal(false)} onSaved={load} />
      )}
    </DashboardShell>
  );
}
