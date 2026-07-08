import { useEffect, useState } from 'react';
import api from '../api.js';
import DashboardShell from '../components/DashboardShell.jsx';
import Preloader from '../components/Preloader.jsx';
import { TrashIcon, RestoreIcon, FolderIcon, ChecklistIcon } from '../components/Icons.jsx';

const RETENTION_DAYS = 30;

function daysLeft(deletedat) {
  const deletedMs = new Date(deletedat).getTime();
  const expiresMs = deletedMs + RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((expiresMs - Date.now()) / (24 * 60 * 60 * 1000)));
}

export default function DeletedItems() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState(null);

  async function load() {
    const { data } = await api.get('/trash');
    setItems(data);
  }
  useEffect(() => { setLoading(true); load().finally(() => setLoading(false)); }, []);

  async function handleRestore(item) {
    setRestoringId(item.id);
    try {
      await api.post('/trash/restore', { type: item.type, id: item.id });
      await load();
    } catch (err) {
      alert(err?.response?.data?.error || 'Could not restore item.');
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <DashboardShell
      title="Deleted Items"
      subtitle="Deleted projects and tasks stay here for 30 days before being permanently removed. Only a Super Admin can restore them."
    >
      {loading ? (
        <Preloader label="Loading deleted items…" />
      ) : items.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-card p-10 text-center">
          <TrashIcon className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Nothing in the trash right now.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-card divide-y divide-gray-50">
          {items.map((item) => {
            const left = daysLeft(item.deletedat);
            return (
              <div key={`${item.type}-${item.id}`} className="flex items-center justify-between gap-3 px-5 py-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: item.type === 'project' ? '#f5f3ff' : '#eef2ff', color: item.type === 'project' ? '#7c3aed' : '#4f46e5' }}
                  >
                    {item.type === 'project' ? <FolderIcon className="w-[18px] h-[18px]" /> : <ChecklistIcon className="w-[18px] h-[18px]" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {item.type === 'project' ? 'Project' : `Task · ${item.projectName || 'Unknown project'}`} · Deleted by {item.deletedby || 'unknown'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <span className={`text-xs font-medium whitespace-nowrap ${left <= 3 ? 'text-google-red' : 'text-gray-400'}`}>
                    {left === 0 ? 'Purging soon' : `${left} day${left !== 1 ? 's' : ''} left`}
                  </span>
                  <button
                    onClick={() => handleRestore(item)}
                    disabled={restoringId === item.id}
                    className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 px-3 py-1.5 rounded-full border border-indigo-100 hover:bg-indigo-50 transition-colors disabled:opacity-50"
                  >
                    <RestoreIcon className="w-[14px] h-[14px]" />
                    {restoringId === item.id ? 'Restoring…' : 'Restore'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardShell>
  );
}
