import { useEffect, useRef, useState } from 'react';

// A lightweight multi-select for picking one or more users (assignees /
// task owners). Deliberately a custom checkbox-list dropdown rather than a
// native <select multiple> — native multi-selects need ctrl/cmd-click to
// pick more than one option, which is unintuitive and easy to trigger by
// accident, and is unreliable to drive from automated tools.
export default function MultiUserSelect({ options, value, onChange, placeholder = 'Select...', disabled = false }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function toggle(username) {
    if (disabled) return;
    if (value.includes(username)) onChange(value.filter((v) => v !== username));
    else onChange([...value, username]);
  }

  return (
    <div className="relative mb-3" ref={rootRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-left bg-white disabled:bg-gray-100 disabled:text-gray-500 flex justify-between items-center gap-2"
      >
        <span className={`truncate ${value.length ? 'text-gray-800' : 'text-gray-400'}`}>
          {value.length ? value.join(', ') : placeholder}
        </span>
        <span className="text-gray-400 text-xs shrink-0">▾</span>
      </button>
      {open && !disabled && (
        <div className="absolute z-30 mt-1 w-full border border-gray-200 rounded-lg max-h-40 overflow-y-auto bg-white shadow-card">
          {options.length === 0 && <div className="px-3 py-2 text-xs text-gray-400">No users available</div>}
          {options.map((u) => (
            <label key={u.id} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer">
              <input type="checkbox" checked={value.includes(u.username)} onChange={() => toggle(u.username)} />
              {u.username}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
