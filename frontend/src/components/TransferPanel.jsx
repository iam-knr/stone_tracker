import { useState } from 'react';
import MultiUserSelect from './MultiUserSelect.jsx';
import { toList } from '../utils/people.js';

// Inline "Transfer ownership/assignee" editor shown on a task card. Lets you
// pick one or more task owners and one or more assignees, then persists
// both in a single save (rather than firing a request per checkbox toggle).
export default function TransferPanel({ task, owners, assignees, onSave, onCancel }) {
  const [taskOwner, setTaskOwner] = useState(toList(task.taskOwner));
  const [assignee, setAssignee] = useState(toList(task.assignee));

  function handleSave() {
    onSave({ taskOwner, assignee });
  }

  return (
    <div className="mb-2" onClick={(e) => e.stopPropagation()}>
      <p className="text-[11px] text-gray-400 mb-1">Reassign owner(s)</p>
      <MultiUserSelect options={owners} value={taskOwner} onChange={setTaskOwner} placeholder="Select owner(s)..." />
      <p className="text-[11px] text-gray-400 mb-1">Reassign assignee(s)</p>
      <MultiUserSelect options={assignees} value={assignee} onChange={setAssignee} placeholder="Select assignee(s)..." />
      <div className="flex gap-2">
        <button onClick={handleSave} className="text-xs text-white bg-indigo-600 rounded-full px-3 py-1 font-medium">Save</button>
        <button onClick={onCancel} className="text-xs text-gray-400">Cancel</button>
      </div>
    </div>
  );
}
