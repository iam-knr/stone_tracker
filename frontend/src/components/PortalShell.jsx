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
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Client Portal</p>
            <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
            {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
          </div>
          <div className="flex items-center justify-between gap-4 sm:justify-end">
            <div className="flex gap-3 text-sm">
              <a href="/portal" className="text-gray-500 hover:text-indigo-600 link-underline">Projects</a>
              <a href="/portal/invoices" className="text-gray-500 hover:text-indigo-600 link-underline">Invoices</a>
              <a href="/portal/quotes" className="text-gray-500 hover:text-indigo-600 link-underline">Quotes</a>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-gray-400 truncate max-w-[110px] sm:max-w-none">{contact.name}</p>
              <button onClick={handleLogout} className="text-xs text-google-red hover:underline">Sign out</button>
            </div>
          </div>
        </div>
      </header>
      <main className="p-4 sm:p-6 max-w-5xl mx-auto">{children}</main>
    </div>
  );
}
