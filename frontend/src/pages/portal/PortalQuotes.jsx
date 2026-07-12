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
          {items.map((q) => (
            <button
              key={q.id}
              onClick={() => onOpen(q.id)}
              className="w-full text-left bg-white rounded-lg shadow-card p-4 flex items-center justify-between hover-lift"
            >
              <div>
                <p className="text-sm font-medium text-gray-800">{q.quoteNumber}</p>
                <p className="text-xs text-gray-400">Expires {q.expiryDate || '-'}</p>
              </div>
              <span className={`text-xs font-medium px-3 py-1 rounded-full ${STATUS_COLORS[bucketKey]}`}>{q.status}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PortalQuotes() {
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
        const { data } = await portalApi.get('/portal/quotes');
        setBuckets({ paid: data.paid || [], upcoming: data.upcoming || [], due: data.due || [] });
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  async function handleOpen(quoteId) {
    try {
      const res = await portalApi.get(`/portal/quotes/${quoteId}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      window.open(url, '_blank');
    } catch (err) {
      alert('Could not open quote.');
    }
  }

  return (
    <PortalShell title="Your Quotes">
      {loading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : (
        <>
          <Section label="Needs your attention" bucketKey="due" items={buckets.due} onOpen={handleOpen} />
          <Section label="Upcoming" bucketKey="upcoming" items={buckets.upcoming} onOpen={handleOpen} />
          <Section label="Accepted" bucketKey="paid" items={buckets.paid} onOpen={handleOpen} />
        </>
      )}
    </PortalShell>
  );
}
