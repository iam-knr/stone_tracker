import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ProjectBoard from './pages/ProjectBoard.jsx';
import AdminUsers from './pages/AdminUsers.jsx';

function isAuthed() { return !!localStorage.getItem('st_token'); }
function isAdmin() { return localStorage.getItem('st_role') === 'admin'; }

function Private({ children }) { return isAuthed() ? children : <Navigate to="/login" />; }
function AdminOnly({ children }) { return isAdmin() ? children : <Navigate to="/" />; }

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Private><Dashboard /></Private>} />
      <Route path="/project/:id" element={<Private><ProjectBoard /></Private>} />
      <Route path="/admin/users" element={<Private><AdminOnly><AdminUsers /></AdminOnly></Private>} />
    </Routes>
  );
}
