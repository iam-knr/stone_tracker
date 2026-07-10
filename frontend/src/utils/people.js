// Small helpers for treating task assignee/taskOwner as lists of usernames.
// Kept tolerant of legacy data: if a task still has a single string value
// (from before multi-assign was added), it's treated as a one-person list.

export function toList(v) {
  if (Array.isArray(v)) return v.filter(Boolean);
  if (typeof v === 'string' && v.trim()) return [v];
  return [];
}

export function formatList(v) {
  const list = toList(v);
  return list.length ? list.join(', ') : '—';
}

export function includesUser(v, username) {
  if (!username) return false;
  return toList(v).includes(username);
}
