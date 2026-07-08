// Lightweight "rich text" description field used for both project and task
// descriptions. Not a full WYSIWYG editor — it stores plain markdown-lite
// text (lines starting with "- " become bullets, "- [ ] "/"- [x] " become
// checkbox rows) and renders that formatting when not being edited. Two
// toolbar buttons insert the right prefix so the user doesn't need to know
// the syntax.

function renderMarkdownLite(text) {
  const lines = text.split('\n');
  const blocks = [];
  let current = null;

  function flush() {
    if (current) { blocks.push(current); current = null; }
  }

  lines.forEach((line) => {
    const checklistMatch = line.match(/^\s*-\s*\[( |x|X)\]\s*(.*)$/);
    const bulletMatch = line.match(/^\s*-\s+(.*)$/);
    if (checklistMatch) {
      if (!current || current.type !== 'checklist') { flush(); current = { type: 'checklist', items: [] }; }
      current.items.push({ done: checklistMatch[1].toLowerCase() === 'x', text: checklistMatch[2] });
    } else if (bulletMatch) {
      if (!current || current.type !== 'ul') { flush(); current = { type: 'ul', items: [] }; }
      current.items.push(bulletMatch[1]);
    } else {
      flush();
      if (line.trim()) blocks.push({ type: 'p', text: line });
    }
  });
  flush();

  return blocks;
}

export function DescriptionView({ text }) {
  if (!text || !text.trim()) return null;
  const blocks = renderMarkdownLite(text);
  return (
    <div className="space-y-1.5">
      {blocks.map((b, i) => {
        if (b.type === 'p') return <p key={i} className="text-sm text-gray-700 whitespace-pre-wrap">{b.text}</p>;
        if (b.type === 'ul') return (
          <ul key={i} className="list-disc list-inside text-sm text-gray-700 space-y-0.5">
            {b.items.map((it, j) => <li key={j}>{it}</li>)}
          </ul>
        );
        if (b.type === 'checklist') return (
          <div key={i} className="space-y-1">
            {b.items.map((it, j) => (
              <label key={j} className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={it.done} readOnly className="mt-0.5 accent-indigo-600" />
                <span className={it.done ? 'line-through text-gray-400' : 'text-gray-700'}>{it.text}</span>
              </label>
            ))}
          </div>
        );
        return null;
      })}
    </div>
  );
}

export default function RichTextField({ value, onChange, editing, setEditing, placeholder, disabled }) {
  function insertPrefix(prefix) {
    onChange((value ? value.replace(/\n?$/, '\n') : '') + prefix);
  }

  if (!editing) {
    return (
      <div
        onClick={() => !disabled && setEditing(true)}
        className={`min-h-[40px] rounded-lg px-2 py-2 -mx-2 transition-colors ${disabled ? '' : 'cursor-text hover:bg-gray-50'}`}
      >
        {value && value.trim() ? (
          <DescriptionView text={value} />
        ) : (
          <p className="text-sm text-gray-400 italic">{placeholder || 'Click to add a description…'}</p>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => insertPrefix('- ')}
          className="text-xs text-gray-500 border border-gray-200 rounded-md px-2 py-1 hover:bg-gray-50"
        >
          • Bullet
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => insertPrefix('- [ ] ')}
          className="text-xs text-gray-500 border border-gray-200 rounded-md px-2 py-1 hover:bg-gray-50"
        >
          ☑ Checklist
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="ml-auto text-xs font-medium text-indigo-600 px-2 py-1"
        >
          Done
        </button>
      </div>
      <textarea
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={6}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
      />
    </div>
  );
}
