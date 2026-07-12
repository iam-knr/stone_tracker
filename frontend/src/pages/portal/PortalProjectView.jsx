import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import portalApi from '../../portalApi.js';
import PortalShell from '../../components/PortalShell.jsx';

function TaskComments({ taskId, canComment }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [open, setOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data } = await portalApi.get(`/portal/tasks/${taskId}/comments`);
      setComments(data || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (open) load(); }, [open]);

  async function handlePost(e) {
    e.preventDefault();
    if (!body.trim()) return;
    setPosting(true);
    try {
      await portalApi.post(`/portal/tasks/${taskId}/comments`, { body: body.trim() });
      setBody('');
      load();
    } catch (err) {
      alert(err?.response?.data?.error || 'Could not post comment.');
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="mt-2">
      <button onClick={() => setOpen(!open)} className="text-xs text-indigo-600 link-underline">
        {open ? 'Hide comments' : 'View comments'}
      </button>
      {open && (
        <div className="mt-2 bg-gray-50 rounded-lg p-3">
          {loading ? (
            <p className="text-xs text-gray-400">Loading...</p>
          ) : comments.length === 0 ? (
            <p className="text-xs text-gray-400">No comments yet.</p>
          ) : (
            <div className="space-y-2 mb-2">
              {comments.map((c) => (
                <div key={c.id} className="text-xs">
                  <span className="font-medium text-gray-700">{c.authorName || (c.authorType === 'portal' ? 'You' : 'Team')}: </span>
                  <span className="text-gray-600">{c.body}</span>
                </div>
              ))}
            </div>
          )}
          {canComment && (
            <form onSubmit={handlePost} className="flex gap-2">
              <input
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 border border-gray-300 rounded-lg px-2 py-1 text-xs"
              />
              <button type="submit" disabled={posting} className="text-xs bg-indigo-600 text-white px-3 py-1 rounded-full disabled:opacity-60">
                {posting ? '...' : 'Post'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

export default function PortalProjectView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [canComment, setCanComment] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem('portal_token')) {
      navigate('/portal/login', { replace: true });
      return;
    }
    let contact = {};
    try { contact = JSON.parse(localStorage.getItem('portal_contact') || '{}'); } catch (e) { contact = {}; }
    setCanComment(!!contact.canComment);

    (async () => {
      try {
        const { data } = await portalApi.get(`/portal/projects/${id}`);
        setProject(data.project);
        setTasks(data.tasks || []);
      } catch (err) {
        navigate('/portal', { replace: true });
      } finally {
        setLoading(false);
      }
    })();
  }, [id, navigate]);

  if (loading || !project) {
    return (
      <PortalShell title="Project">
        <p className="text-sm text-gray-400">Loading...</p>
      </PortalShell>
    );
  }

  return (
    <PortalShell
      title={project.name}
      subtitle={<button onClick={() => navigate('/portal')} className="text-indigo-600 link-underline">&larr; Back to projects</button>}
    >
      <div className="bg-white rounded-2xl shadow-card p-6">
        <p className="text-sm text-gray-500 mb-1">Status: {project.status}</p>
        {project.deadline && <p className="text-sm text-gray-500 mb-4">Deadline: {project.deadline}</p>}

        <p className="text-xs font-semibold text-gray-700 mt-4 mb-2">Tasks</p>
        {tasks.length === 0 ? (
          <p className="text-sm text-gray-400">No tasks yet.</p>
        ) : (
          <div className="space-y-3">
            {tasks.map((t) => (
              <div key={t.id} className="border border-gray-100 rounded-lg p-3">
                <p className="text-sm font-medium text-gray-800">{t.taskName || t.title || t.name}</p>
                <p className="text-xs text-gray-400">{t.status}</p>
                <TaskComments taskId={t.id} canComment={canComment} />
              </div>
            ))}
          </div>
        )}
      </div>
    </PortalShell>
  );
}
