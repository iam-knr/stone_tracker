import { useState } from 'react';
import api from '../api.js';
import PriorityBadge from './PriorityBadge.jsx';
import RichTextField from './RichTextField.jsx';

const STATUSES = ['To Do', 'In Progress', 'Review', 'Done'];
const PRIORITIES = ['High', 'Medium', 'Low'];

function parseChecklist(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
  }
  return [];
}

function ChecklistSection({ items, onChange, disabled }) {
  const [newItem, setNewItem] = useState('');
  const done = items.filter((i) => i.done).length;

  function addItem() {
    if (!newItem.trim()) return;
    onChange([...items, { id: `sub-${Date.now()}`, text: newItem.trim(), done: false }]);
    setNewItem('');
  }
  function toggle(id) {
    onChange(items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));
  }
  function remove(id) {
    onChange(items.filter((i) => i.id !== id));
  }

  return (
    <div>
      {items.length > 0 && (
        <div className="mb-2.5">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>{done}/{items.length} completed</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full bg-indigo-600 rounded-full transition-all" style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }} />
          </div>
        </div>
      )}
      <div className="space-y-1.5 mb-2.5">
        {items.map((it) => (
          <div key={it.id} className="group flex items-center gap-2">
            <input type="checkbox" checked={it.done} disabled={disabled} onChange={() => toggle(it.id)} className="accent-indigo-600 shrink-0" />
            <span className={`flex-1 text-sm ${it.done ? 'line-through text-gray-400' : 'text-gray-700'}`}>{it.text}</span>
            {!disabled && (
              <button type="button" onClick={() => remove(it.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-google-red text-xs shrink-0 transition-opacity">✕</button>
            )}
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-gray-400">No subtasks yet.</p>}
      </div>
      {!disabled && (
        <div className="flex gap-2">
          <input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
            placeholder="Add a subtask…"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
          />
          <button type="button" onClick={addItem} className="text-xs font-medium text-indigo-600 px-3 py-1.5 rounded-lg border border-indigo-100 hover:bg-indigo-50 shrink-0">Add</button>
        </div>
      )}
    </div>
  );
}

export default function TaskDetailModal({ task, onClose, onSaved }) {
  const [description, setDescription] = useState(task.description || '');
  const [editingDesc, setEditingDesc] = useState(false);
  const [checklist, setChecklist] = useState(() => parseChecklist(task.checklist));
  const [status, setStatus] = useState(task.status);
  const [priority, setPriority] = useState(task.priority);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await api.put(`/tasks/${task.id}`, { description, checklist, status, priority });
      onSaved?.();
      onClose();
    } catch (err) {
      alert(err?.response?.data?.error || 'Could not save task.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-30 animate-fade-in" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-start justify-between gap-3 mb-1.5">
          <h2 className="text-lg font-semibold text-gray-900 leading-snug">{task.taskName}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-sm px-1 shrink-0">✕</button>
        </div>
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <PriorityBadge priority={priority} />
          <span className="text-xs text-gray-400">Assignee: {task.assignee || '—'}</span>
          <span className="text-xs text-gray-400">Owner: {task.taskOwner || '—'}</span>
          {task.startDate && <span className="text-xs text-gray-400">Start {task.startDate}</span>}
          {task.dueDate && <span className="text-xs text-gray-400">Due {task.dueDate}</span>}
        </div>

        <div className="flex gap-3 mb-5">
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500">
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select value={priority} onChange={(e) => setPriority(e.target.value)}
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500">
            {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>

        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Description</p>
        <RichTextField
          value={description}
          onChange={setDescription}
          editing={editingDesc}
          setEditing={setEditingDesc}
          placeholder="Add a description… use Bullet/Checklist buttons or write plain paragraphs."
        />

        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-5 mb-1.5">Subtasks &amp; Checklist</p>
        <ChecklistSection items={checklist} onChange={setChecklist} />

        <div className="flex gap-3 mt-6">
          <button type="button" onClick={onClose} className="w-1/2 py-2 rounded-full border border-gray-300 text-gray-600 hover-lift">Close</button>
          <button type="button" onClick={handleSave} disabled={saving} className="w-1/2 py-2 rounded-full bg-indigo-600 text-white font-medium btn-modern disabled:opacity-60">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
