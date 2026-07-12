import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import portalApi from '../../portalApi.js';
import PortalShell from '../../components/PortalShell.jsx';

const STATUS_COLORS = {
  paid: 'bg-google-green/10 text-google-green',
  upcoming: 'bg-indigo-100 text-indigo-700',
  due: 'bg-red-50 text-google-red',
};

function Section({ label, bucketKey, items, onOpen }) {
  return (
    <div className="mb-6">
      <p className="text-xs font-semibold text-gray-700 mb-2">{label} ({items.length})</p>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400">Nothing here.</p>
      ) : (
        <div className="space-y-2">
          {items.map((inv) => (
            <button
              key={inv.id}
              onClick={() => onOpen(inv.id)}
              className="w-full text-left bg-white rounded-lg shadow-card p-4 flex items-center justify-between hover-lift"
            >
              <div>
                <p className="text-sm font-medium text-gray-800">{inv.invoiceNumber}</p>
                <p className="text-xs text-gray-400">Due {inv.dueDate || '-'}</p>
              </div>
              <span className={`text-xs font-medium px-3 py-1 rounded-full ${STATUS_COLORS[bucketKey]}`}>{inv.status}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PortalInvoices() {
  const navigate = useNavigate();
  const [buckets, setBuckets] = useState({ paid: [], upcoming: [], due: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem('portal_token')) {
      navigate('/portal/login', { replace: true });
      return;
    }
    (async () => {
      try {
        const { data } = await portalApi.get('/portal/invoices');
        setBuckets({ paid: data.paid || [], upcoming: data.upcoming || [], due: data.due || [] });
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  async function handleOpen(invId) {
    try {
      const res = await portalApi.get(`/portal/invoices/${invId}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      window.open(url, '_blank');
    } catch (err) {
      alert('Could not open invoice.');
    }
  }

  return (
    <PortalShell title="Your Invoices">
      {loading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : (
        <>
          <Section label="Due" bucketKey="due" items={buckets.due} onOpen={handleOpen} />
          <Section label="Upcoming" bucketKey="upcoming" items={buckets.upcoming} onOpen={handleOpen} />
          <Section label="Paid" bucketKey="paid" items={buckets.paid} onOpen={handleOpen} />
        </>
      )}
    </PortalShell>
  );
}
