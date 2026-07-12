import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import portalApi from '../../portalApi.js';

export default function PortalVerify() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying'); // 'verifying' | 'error'
  const [error, setError] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setError('This sign-in link is missing its token.');
      return;
    }
    (async () => {
      try {
        const { data } = await portalApi.post('/portal/verify', { token });
        localStorage.setItem('portal_token', data.token);
        localStorage.setItem('portal_contact', JSON.stringify(data.contact));
        navigate('/portal', { replace: true });
      } catch (err) {
        setStatus('error');
        setError(err?.response?.data?.error || 'Could not verify this sign-in link.');
      }
    })();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-card p-8 w-full max-w-sm text-center">
        {status === 'verifying' ? (
          <p className="text-sm text-gray-500">Signing you in...</p>
        ) : (
          <>
            <p className="text-sm text-google-red mb-4">{error}</p>
            <a href="/portal/login" className="text-sm text-indigo-600 link-underline">Request a new sign-in link</a>
          </>
        )}
      </div>
    </div>
  );
}
