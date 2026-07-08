function CircularProgress({ value, color = '#34a853' }) {
  const size = 52;
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(Math.max(value, 0), 100) / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
    </svg>
  );
}

export default function StatCard({ label, value, icon: Icon, iconBg, iconColor, accent, ring }) {
  return (
    <div
      className={`bg-white rounded-2xl shadow-card p-4 hover-lift ${accent ? 'border-l-4 border-google-red' : 'border border-transparent'}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-medium tracking-wide text-gray-400 uppercase">{label}</p>
          <p className={`text-3xl font-semibold mt-2 ${accent ? 'text-google-red' : 'text-gray-900'}`}>{value}</p>
        </div>
        {ring !== undefined ? (
          <CircularProgress value={ring} color={accent ? '#ea4335' : '#34a853'} />
        ) : Icon ? (
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: iconBg || '#eef2ff', color: iconColor || '#4f46e5' }}
          >
            <Icon className="w-5 h-5" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
