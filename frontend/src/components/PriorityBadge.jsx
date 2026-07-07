const COLORS = {
  High: 'bg-red-100 text-google-red',
  Medium: 'bg-yellow-100 text-yellow-700',
  Low: 'bg-green-100 text-google-green',
};

export default function PriorityBadge({ priority }) {
  return (
    <span className={`text-xs font-medium px-2 py-1 rounded-full ${COLORS[priority] || 'bg-gray-100 text-gray-600'}`}>
      {priority}
    </span>
  );
}
