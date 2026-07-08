import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api.js';
import RichTextField from './RichTextField.jsx';

const STATUSES = ['Not Started', 'In Progress', 'On Hold', 'Completed'];

export default function ProjectDetailModal({ project, onClose, onSaved, canEdit }) {
  const navigate = useNavigate();
  const [name, setName] = useState(project.name);
  const [client, setClient] = useState(project.client);
  const [description, setDescription] = useState(project.description || '');
  const [editingDesc, setEditingDesc] = useState(false);
  const [status, setStatus] = useState(project.status);
  const [startDate, setStartDate] = useState(project.startDate || '');
  const [deadline, setDeadline] = useState(project.deadline || '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await api.put(`/projects/${project.id}`, {
        name, client, description, status,
        startDate: startDate || null, deadline: deadline || null,
      });
      onSaved?.();
      onClose();
    } catch (err) {
      alert(err?.response?.data?.error || 'Could not save project.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-30 animate-fade-in" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          {canEdit ? (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-lg font-semibold text-gray-900 border-b border-transparent hover:border-gray-200 focus:border-indigo-400 focus:outline-none flex-1 min-w-0"
            />
          ) : (
            <h2 className="text-lg font-semibold text-gray-900">{name}</h2>
          )}
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-sm px-1 shrink-0">✕</button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Client</label>
            <input value={client} disabled={!canEdit} onChange={(e) => setClient(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Status</label>
            <select value={status} disabled={!canEdit} onChange={(e) => setStatus(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400">
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Start</label>
            <input type="date" value={startDate || ''} disabled={!canEdit} onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Deadline</label>
            <input type="date" value={deadline || ''} disabled={!canEdit} onChange={(e) => setDeadline(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400" />
          </div>
        </div>

        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Description</p>
        <RichTextField
          value={description}
          onChange={setDescription}
          editing={editingDesc}
          setEditing={setEditingDesc}
          disabled={!canEdit}
          placeholder="Add a project description… use Bullet/Checklist buttons or write plain paragraphs."
        />

        <div className="flex gap-3 mt-6">
          <button type="button" onClick={() => navigate(`/project/${project.id}`)} className="w-1/2 py-2 rounded-full border border-gray-300 text-gray-600 hover-lift">Open board</button>
          {canEdit ? (
            <button type="button" onClick={handleSave} disabled={saving} className="w-1/2 py-2 rounded-full bg-indigo-600 text-white font-medium btn-modern disabled:opacity-60">
              {saving ? 'Saving…' : 'Save'}
            </button>
          ) : (
            <button type="button" onClick={onClose} className="w-1/2 py-2 rounded-full bg-indigo-600 text-white font-medium btn-modern">Close</button>
          )}
        </div>
      </div>
    </div>
  );
}
