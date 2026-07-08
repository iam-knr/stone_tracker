import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api.js';
import DashboardShell from '../components/DashboardShell.jsx';
import AdminOverview from '../components/AdminOverview.jsx';
import Preloader from '../components/Preloader.jsx';

export default function Dashboard() {
  const role = localStorage.getItem('st_role');
  const isAdmin = role === 'admin';
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const [{ data: p }, { data: t }] = await Promise.all([api.get('/projects'), api.get('/tasks')]);
    setProjects(p);
    setTasks(t);
  }
  useEffect(() => { setLoading(true); load().finally(() => setLoading(false)); }, []);

  return (
    <DashboardShell
      title="Dashboard Overview"
      subtitle="Welcome back, here's what's happening today."
      actions={
        <>
          {isAdmin && <Link to="/admin/users" className="text-sm font-medium text-indigo-600 link-underline">Manage Users</Link>}
          {(isAdmin || role === 'task_owner') && (
            <Link to="/projects" className="bg-indigo-600 text-white text-sm font-medium px-4 py-2.5 rounded-full shadow-card btn-modern flex items-center gap-2">
              <span className="text-lg leading-none">+</span> New Project
            </Link>
          )}
        </>
      }
    >
      {loading ? <Preloader label="Loading your workspace…" /> : <AdminOverview projects={projects} tasks={tasks} />}
    </DashboardShell>
  );
}
