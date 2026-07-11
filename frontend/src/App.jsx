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
import Invoices from './pages/Invoices.jsx';
import InvoiceEditor from './pages/InvoiceEditor.jsx';
import InvoiceView from './pages/InvoiceView.jsx';
import Contacts from './pages/Contacts.jsx';
import ContactView from './pages/ContactView.jsx';
import Quotes from './pages/Quotes.jsx';
import QuoteEditor from './pages/QuoteEditor.jsx';
import QuoteView from './pages/QuoteView.jsx';
import Items from './pages/Items.jsx';
import CustomFieldsAdmin from './pages/CustomFieldsAdmin.jsx';
import Reports from './pages/Reports.jsx';

function isAuthed() { return !!localStorage.getItem('st_token'); }
function isAdmin() { return localStorage.getItem('st_role') === 'admin'; }

function Private({ children }) { return isAuthed() ? children : <Navigate to="/login" />; }
function AdminOnly({ children }) { return isAdmin() ? children : <Navigate to="/" />; }
// Invoicing is a separate per-user grant (see AdminUsers > Invoice Access),
// independent of role — admin always has it, everyone else needs the flag
// set on their account at login time.
function InvoiceAccessOnly({ children }) {
  const allowed = isAdmin() || localStorage.getItem('st_can_invoices') === 'true';
  return allowed ? children : <Navigate to="/" />;
}

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
      <Route path="/admin/custom-fields" element={<Private><AdminOnly><CustomFieldsAdmin /></AdminOnly></Private>} />
      <Route path="/invoices" element={<Private><InvoiceAccessOnly><Invoices /></InvoiceAccessOnly></Private>} />
      <Route path="/invoices/new" element={<Private><InvoiceAccessOnly><InvoiceEditor /></InvoiceAccessOnly></Private>} />
      <Route path="/invoices/:id" element={<Private><InvoiceAccessOnly><InvoiceView /></InvoiceAccessOnly></Private>} />
      <Route path="/invoices/:id/edit" element={<Private><InvoiceAccessOnly><InvoiceEditor /></InvoiceAccessOnly></Private>} />
      <Route path="/contacts" element={<Private><InvoiceAccessOnly><Contacts /></InvoiceAccessOnly></Private>} />
      <Route path="/contacts/:id" element={<Private><InvoiceAccessOnly><ContactView /></InvoiceAccessOnly></Private>} />
      <Route path="/quotes" element={<Private><InvoiceAccessOnly><Quotes /></InvoiceAccessOnly></Private>} />
      <Route path="/quotes/new" element={<Private><InvoiceAccessOnly><QuoteEditor /></InvoiceAccessOnly></Private>} />
      <Route path="/quotes/:id" element={<Private><InvoiceAccessOnly><QuoteView /></InvoiceAccessOnly></Private>} />
      <Route path="/quotes/:id/edit" element={<Private><InvoiceAccessOnly><QuoteEditor /></InvoiceAccessOnly></Private>} />
      <Route path="/items" element={<Private><InvoiceAccessOnly><Items /></InvoiceAccessOnly></Private>} />
      <Route path="/reports" element={<Private><InvoiceAccessOnly><Reports /></InvoiceAccessOnly></Private>} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
