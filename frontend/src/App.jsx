import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Projects from './pages/Projects.jsx';
import Tasks from './pages/Tasks.jsx';
import Settings from './pages/Settings.jsx';
import ProjectBoard from './pages/ProjectBoard.jsx';
import AdminUsers from './pages/AdminUsers.jsx';
import DeletedItems from './pages/DeletedItems.jsx';

function isAuthed() { return !!localStorage.getItem('st_token'); }
function isAdmin() { return localStorage.getItem('st_role') === 'admin'; }

function Private({ children }) { return isAuthed() ? children : <Navigate to="/login" />; }
function AdminOnly({ children }) { return isAdmin() ? children : <Navigate to="/" />; }

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/" element={<Private><Dashboard /></Private>} />
      <Route path="/projects" element={<Private><Projects /></Private>} />
      <Route path="/tasks" element={<Private><Tasks /></Private>} />
      <Route path="/settings" element={<Private><Settings /></Private>} />
      <Route path="/project/:id" element={<Private><ProjectBoard /></Private>} />
      <Route path="/admin/users" element={<Private><AdminOnly><AdminUsers /></AdminOnly></Private>} />
      <Route path="/admin/deleted-items" element={<Private><AdminOnly><DeletedItems /></AdminOnly></Private>} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
