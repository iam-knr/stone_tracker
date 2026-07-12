import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import portalApi from '../../portalApi.js';
import PortalShell from '../../components/PortalShell.jsx';

export default function PortalDashboard() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem('portal_token')) {
      navigate('/portal/login', { replace: true });
      return;
    }
    (async () => {
      try {
        const { data } = await portalApi.get('/portal/projects');
        setProjects(data || []);
      } catch (err) {
        if (err?.response?.status === 401 || err?.response?.status === 403) {
          localStorage.removeItem('portal_token');
          navigate('/portal/login', { replace: true });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  return (
    <PortalShell title="Your Projects" subtitle="Tap a project to see its tasks and progress.">
      {loading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : projects.length === 0 ? (
        <p className="text-sm text-gray-400">No projects have been shared with you yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => navigate(`/portal/projects/${p.id}`)}
              className="text-left bg-white rounded-2xl shadow-card p-5 hover-lift"
            >
              <p className="font-medium text-gray-900 mb-1">{p.name}</p>
              <p className="text-xs text-gray-400 mb-2">{p.status}</p>
              {p.deadline && <p className="text-xs text-gray-500">Deadline: {p.deadline}</p>}
            </button>
          ))}
        </div>
      )}
    </PortalShell>
  );
}
