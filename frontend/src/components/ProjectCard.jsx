import { useNavigate } from 'react-router-dom';

const STATUS_COLORS = {
  'Not Started': 'bg-gray-100 text-gray-600',
  'In Progress': 'bg-blue-100 text-google-blue',
  'On Hold': 'bg-yellow-100 text-yellow-700',
  'Completed': 'bg-green-100 text-google-green',
};

export default function ProjectCard({ project }) {
  const navigate = useNavigate();
  return (
    <div
      onClick={() => navigate(`/project/${project.id}`)}
      className="bg-white rounded-xl shadow-card p-4 cursor-pointer hover:shadow-lg transition active:scale-[0.99]"
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-medium text-gray-800">{project.name}</h3>
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_COLORS[project.status] || 'bg-gray-100'}`}>
          {project.status}
        </span>
      </div>
      <p className="text-sm text-gray-500 mb-2">{project.client}</p>
      <div className="flex justify-between text-xs text-gray-400">
        <span>Start: {project.startDate}</span>
        <span>Due: {project.deadline}</span>
      </div>
    </div>
  );
}
