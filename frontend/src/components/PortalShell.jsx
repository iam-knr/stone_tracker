import { useNavigate } from 'react-router-dom';

export default function PortalShell({ title, subtitle, children }) {
  const navigate = useNavigate();
  let contact = {};
  try { contact = JSON.parse(localStorage.getItem('portal_contact') || '{}'); } catch (e) { contact = {}; }

  function handleLogout() {
    localStorage.removeItem('portal_token');
    localStorage.removeItem('portal_contact');
    navigate('/portal/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Client Portal</p>
          <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-3 text-sm">
            <a href="/portal" className="text-gray-500 hover:text-indigo-600 link-underline">Projects</a>
            <a href="/portal/invoices" className="text-gray-500 hover:text-indigo-600 link-underline">Invoices</a>
            <a href="/portal/quotes" className="text-gray-500 hover:text-indigo-600 link-underline">Quotes</a>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">{contact.name}</p>
            <button onClick={handleLogout} className="text-xs text-google-red hover:underline">Sign out</button>
          </div>
        </div>
      </header>
      <main className="p-6 max-w-5xl mx-auto">{children}</main>
    </div>
  );
}
