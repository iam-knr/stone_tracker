import { useEffect, useState } from 'react';
import api from '../api.js';
import DashboardShell from '../components/DashboardShell.jsx';
import Preloader from '../components/Preloader.jsx';
import { money } from '../utils/invoiceMath.js';

const QUOTE_COLORS = {
  Draft: 'bg-gray-100 text-gray-600',
  Sent: 'bg-indigo-100 text-indigo-700',
  Accepted: 'bg-google-green/10 text-google-green',
  Rejected: 'bg-red-50 text-google-red',
  Expired: 'bg-yellow-50 text-yellow-700',
};

function StatCard({ label, value, tone }) {
  const toneClass = tone === 'green' ? 'text-google-green' : tone === 'red' ? 'text-google-red' : 'text-gray-800';
  return (
    <div className="bg-white rounded-2xl shadow-card p-5">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function Bar({ label, value, max, colorClass, valueLabel }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{label}</span>
        <span className="font-medium text-gray-700">{valueLabel}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }} />
      </div>
    </div>
  );
}

export default function BusinessHealth() {
  const [data, setData] = useState(null);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/business-health/summary'),
      api.get('/invoices/settings').catch(() => ({ data: {} })),
    ])
      .then(([{ data: d }, { data: s }]) => {
        setData(d);
        setSettings(s || {});
      })
      .catch((err) => {
        setError(err?.response?.data?.error || 'Could not load Business Health data.');
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <DashboardShell title="Business Health"><Preloader label="Loading business health…" /></DashboardShell>;
  }

  if (error || !data) {
    return (
      <DashboardShell title="Business Health">
        <p className="text-google-red text-sm">{error || 'Something went wrong.'}</p>
      </DashboardShell>
    );
  }

  const currency = settings.currencySymbol;
  const { revenue, quotePipeline, delivery, clientHealth } = data;
  const maxMonth = Math.max(1, ...revenue.revenueByMonth.map((m) => m.total));
  const maxWorkload = Math.max(1, ...delivery.topWorkload.map((w) => w.openTasks));
  const maxClientRevenue = Math.max(1, ...clientHealth.revenueByClient.map((c) => c.total));

  return (
    <DashboardShell title="Business Health" subtitle="Revenue, pipeline, delivery, and client health in one view.">
      {/* Revenue & cash flow */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Revenue &amp; Cash Flow</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <StatCard label="Total Billed" value={money(revenue.totalBilled, currency)} />
          <StatCard label="Total Paid" value={money(revenue.totalPaid, currency)} tone="green" />
          <StatCard label="Outstanding" value={money(revenue.totalOutstanding, currency)} />
          <StatCard label="Overdue" value={money(revenue.totalOverdue, currency)} tone="red" />
        </div>
        <div className="bg-white rounded-2xl shadow-card p-6">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Revenue — Last 6 Months</h3>
          {revenue.revenueByMonth.every((m) => m.total === 0) ? (
            <p className="text-gray-400 text-sm">No invoices in this window yet.</p>
          ) : (
            <div className="space-y-3">
              {revenue.revenueByMonth.map((m) => (
                <Bar key={m.month} label={m.month} value={m.total} max={maxMonth} colorClass="bg-google-green" valueLabel={money(m.total, currency)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quote pipeline */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Quote Pipeline</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <StatCard label="Open Pipeline (Sent)" value={money(quotePipeline.openPipelineValue, currency)} />
          <StatCard label="Conversion Rate" value={quotePipeline.conversionRate === null ? '—' : `${quotePipeline.conversionRate}%`} />
          <StatCard label="Total Quotes" value={quotePipeline.totalQuotes} />
        </div>
        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800">By Status</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Count</th>
                <th className="px-5 py-3 font-medium">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {Object.keys(quotePipeline.counts).map((status) => (
                <tr key={status}>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${QUOTE_COLORS[status] || 'bg-gray-100 text-gray-600'}`}>{status}</span>
                  </td>
                  <td className="px-5 py-3 text-gray-700">{quotePipeline.counts[status]}</td>
                  <td className="px-5 py-3 text-gray-700">{money(quotePipeline.values[status], currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Project & task delivery health */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Project &amp; Task Delivery Health</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <StatCard label="Active Projects" value={delivery.activeProjectCount} />
          <StatCard label="Overdue Projects" value={delivery.overdueProjects} tone={delivery.overdueProjects > 0 ? 'red' : undefined} />
          <StatCard label="Open Tasks" value={delivery.openTaskCount} />
          <StatCard label="Overdue Tasks" value={delivery.overdueTasks} tone={delivery.overdueTasks > 0 ? 'red' : undefined} />
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl shadow-card p-6">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Projects by Status</h3>
            <div className="space-y-3">
              {Object.entries(delivery.projectStatusCounts).map(([status, count]) => (
                <div key={status} className="flex justify-between text-sm">
                  <span className="text-gray-500">{status}</span>
                  <span className="font-medium text-gray-800">{count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-card p-6">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Tasks by Status</h3>
            <div className="space-y-3">
              {Object.entries(delivery.taskStatusCounts).map(([status, count]) => (
                <div key={status} className="flex justify-between text-sm">
                  <span className="text-gray-500">{status}</span>
                  <span className="font-medium text-gray-800">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        {delivery.topWorkload.length > 0 && (
          <div className="bg-white rounded-2xl shadow-card p-6 mt-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Open Task Workload</h3>
            <div className="space-y-3">
              {delivery.topWorkload.map((w) => (
                <Bar key={w.username} label={w.username} value={w.openTasks} max={maxWorkload} colorClass="bg-indigo-500" valueLabel={String(w.openTasks)} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Client health */}
      <div>
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Client Health</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <StatCard label="Total Contacts" value={clientHealth.totalContacts} />
          <StatCard label="Portal Access Enabled" value={clientHealth.portalEnabledCount} />
          <StatCard label="Comments Enabled" value={clientHealth.commentsEnabledCount} />
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl shadow-card p-6">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Top Clients by Revenue</h3>
            {clientHealth.revenueByClient.length === 0 ? (
              <p className="text-gray-400 text-sm">No invoices yet.</p>
            ) : (
              <div className="space-y-3">
                {clientHealth.revenueByClient.map((c) => (
                  <Bar key={c.clientName} label={c.clientName} value={c.total} max={maxClientRevenue} colorClass="bg-indigo-500" valueLabel={money(c.total, currency)} />
                ))}
              </div>
            )}
          </div>
          <div className="bg-white rounded-2xl shadow-card p-6">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Clients with Overdue Invoices</h3>
            {clientHealth.clientsWithOverdueInvoices.length === 0 ? (
              <p className="text-gray-400 text-sm">Nothing overdue right now.</p>
            ) : (
              <div className="space-y-2">
                {clientHealth.clientsWithOverdueInvoices.map((c) => (
                  <div key={c.clientName} className="flex justify-between text-sm">
                    <span className="text-gray-600">{c.clientName}</span>
                    <span className="font-medium text-google-red">{money(c.total, currency)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
