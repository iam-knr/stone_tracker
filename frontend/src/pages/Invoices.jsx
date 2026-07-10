import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api.js';
import DashboardShell from '../components/DashboardShell.jsx';
import Preloader from '../components/Preloader.jsx';
import { GearIcon } from '../components/Icons.jsx';
import { computeInvoiceTotals, money } from '../utils/invoiceMath.js';

const STATUS_COLORS = {
  Draft: 'bg-gray-100 text-gray-600',
  Sent: 'bg-indigo-100 text-indigo-700',
  Paid: 'bg-google-green/10 text-google-green',
  Overdue: 'bg-red-50 text-google-red',
};

// Resizes/compresses an uploaded image client-side before it's stored as a
// base64 data URI on the invoice settings row — keeps the payload small
// regardless of how large the source photo/logo file is.
function fileToResizedDataUrl(file, maxDim = 300) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function SettingsModal({ initial, onClose, onSaved }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [logoError, setLogoError] = useState('');

  async function handleLogoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoError('');
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      setForm((f) => ({ ...f, companyLogo: dataUrl }));
    } catch {
      setLogoError('Could not read that image file.');
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/invoices/settings', form);
      onSaved();
      onClose();
    } catch (err) {
      alert(err?.response?.data?.error || 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-30 animate-fade-in">
      <form onSubmit={handleSave} className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-medium mb-4">Company Info</h2>
        <p className="text-xs text-gray-400 mb-3">Shown on the header of every invoice PDF.</p>
        <label className="block text-xs text-gray-500 mb-1">Company Logo</label>
        <div className="flex items-center gap-3 mb-3">
          {form.companyLogo ? (
            <img src={form.companyLogo} alt="Logo preview" className="w-14 h-14 rounded-lg object-contain border border-gray-200 bg-gray-50" />
          ) : (
            <div className="w-14 h-14 rounded-lg border border-dashed border-gray-300 flex items-center justify-center text-[10px] text-gray-400">No logo</div>
          )}
          <div>
            <input type="file" accept="image/*" onChange={handleLogoChange} className="block text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:bg-indigo-50 file:text-indigo-600 file:text-xs file:font-medium" />
            {logoError && <p className="text-[11px] text-google-red mt-1">{logoError}</p>}
          </div>
        </div>
        <label className="block text-xs text-gray-500 mb-1">Company Name</label>
        <input value={form.companyName || ''} onChange={(e) => setForm({ ...form, companyName: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3 text-sm" />
        <label className="block text-xs text-gray-500 mb-1">Email</label>
        <input value={form.companyEmail || ''} onChange={(e) => setForm({ ...form, companyEmail: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3 text-sm" />
        <label className="block text-xs text-gray-500 mb-1">Phone</label>
        <input value={form.companyPhone || ''} onChange={(e) => setForm({ ...form, companyPhone: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3 text-sm" />
        <label className="block text-xs text-gray-500 mb-1">Address</label>
        <textarea value={form.companyAddress || ''} onChange={(e) => setForm({ ...form, companyAddress: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3 text-sm" rows={2} />
        <label className="block text-xs text-gray-500 mb-1">GSTIN</label>
        <input value={form.companyGstin || ''} onChange={(e) => setForm({ ...form, companyGstin: e.target.value })}
          placeholder="e.g. 22AAAAA0000A1Z5"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3 text-sm" />
        <p className="text-[11px] text-gray-400 -mt-2 mb-3">Set once here — only a Super Admin can change your company's GSTIN.</p>

        <div className="border-t border-gray-100 pt-3 mt-1 mb-3">
          <p className="text-sm font-medium text-gray-700 mb-2">Bank Account Details</p>
          <label className="block text-xs text-gray-500 mb-1">Account Name</label>
          <input value={form.bankAccountName || ''} onChange={(e) => setForm({ ...form, bankAccountName: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3 text-sm" />
          <label className="block text-xs text-gray-500 mb-1">Account Number</label>
          <input value={form.bankAccountNumber || ''} onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3 text-sm" />
          <label className="block text-xs text-gray-500 mb-1">IFSC Code</label>
          <input value={form.bankIfsc || ''} onChange={(e) => setForm({ ...form, bankIfsc: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-1 text-sm" />
          <p className="text-[11px] text-gray-400">Set once here — only a Super Admin can change these. Shown on every invoice for bank-transfer payments.</p>
        </div>

        <label className="block text-xs text-gray-500 mb-1">Currency Symbol</label>
        <input value={form.currencySymbol || '$'} onChange={(e) => setForm({ ...form, currencySymbol: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 text-sm" />
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="w-1/2 py-2 rounded-full border border-gray-300 text-gray-600 hover-lift">Cancel</button>
          <button disabled={saving} className="w-1/2 py-2 rounded-full bg-indigo-600 text-white font-medium btn-modern disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}

export default function Invoices() {
  const navigate = useNavigate();
  const role = localStorage.getItem('st_role');
  const isAdmin = role === 'admin';
  const [invoices, setInvoices] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  async function load() {
    const [{ data: inv }, { data: s }] = await Promise.all([
      api.get('/invoices'),
      api.get('/invoices/settings'),
    ]);
    setInvoices(inv);
    setSettings(s);
  }
  useEffect(() => { setLoading(true); load().finally(() => setLoading(false)); }, []);

  const sorted = [...invoices].sort((a, b) => Number(b.id) - Number(a.id));

  return (
    <DashboardShell
      title="Invoices"
      subtitle="Create, preview, and email invoices to your clients."
      actions={
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button onClick={() => setShowSettings(true)} className="flex items-center gap-1.5 text-sm font-medium text-gray-500 border border-gray-200 px-3.5 py-2 rounded-full hover:border-indigo-200 hover:text-indigo-600 hover:bg-indigo-50/50 transition-colors">
              <GearIcon className="w-[15px] h-[15px]" /> Company Info
            </button>
          )}
          <button onClick={() => navigate('/invoices/new')} className="bg-indigo-600 text-white text-sm font-medium px-4 py-2.5 rounded-full shadow-card btn-modern flex items-center gap-2">
            <span className="text-lg leading-none">+</span> New Invoice
          </button>
        </div>
      }
    >
      {loading ? (
        <Preloader label="Loading invoices…" />
      ) : (
        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="px-5 py-3 font-medium">Invoice #</th>
                <th className="px-5 py-3 font-medium">Client</th>
                <th className="px-5 py-3 font-medium">Total</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 animate-stagger">
              {sorted.map((inv) => {
                const { total } = computeInvoiceTotals(inv);
                return (
                  <tr key={inv.id} onClick={() => navigate(`/invoices/${inv.id}`)} className="cursor-pointer hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-800">{inv.invoiceNumber}</td>
                    <td className="px-5 py-3 text-gray-500">{inv.clientName}</td>
                    <td className="px-5 py-3 text-gray-700 font-medium">{money(total, settings.currencySymbol)}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_COLORS[inv.status] || 'bg-gray-100'}`}>{inv.status || 'Draft'}</span>
                    </td>
                    <td className="px-5 py-3 text-gray-500">{inv.dueDate || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {sorted.length === 0 && <p className="text-gray-400 text-sm text-center p-8">No invoices yet. Create your first one.</p>}
        </div>
      )}

      {showSettings && (
        <SettingsModal initial={settings} onClose={() => setShowSettings(false)} onSaved={load} />
      )}
    </DashboardShell>
  );
}
