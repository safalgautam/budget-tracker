const SUPA_URL = 'https://afobsnqtywtlupqjimaz.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmb2JzbnF0eXd0bHVwcWppbWF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzA0NTIsImV4cCI6MjA4OTQwNjQ1Mn0.MWrWZkZD8fkDa9HCLQUCwPcBm4zmNuWDGWyXMUr77BM';

// Always use the current logged-in user's JWT token
function H() {
  return {
    'Content-Type': 'application/json',
    'apikey': SUPA_KEY,
    'Authorization': 'Bearer ' + (window._authToken || SUPA_KEY)
  };
}

// RLS automatically filters by the JWT user — no manual user_id filter needed
// For admin viewing another user, we add an explicit user_id filter on top
function withAdminFilter(params = '') {
  if (window._adminViewUserId) {
    return (params ? params + '&' : '') + `user_id=eq.${window._adminViewUserId}`;
  }
  return params;
}

async function sbGet(table, params = '') {
  const url = `${SUPA_URL}/rest/v1/${table}${params ? '?' + params : ''}`;
  const r = await fetch(url, { headers: { ...H(), 'Accept': 'application/json' } });
  const txt = await r.text();
  if (!r.ok) throw new Error(`${r.status}: ${txt}`);
  return JSON.parse(txt);
}

// Use this for all data fetches — respects admin user switching
async function sbGetAsUser(table, params = '') {
  return sbGet(table, withAdminFilter(params));
}

async function sbInsert(table, body) {
  // Attach the correct user_id to every row
  const userId = window._adminViewUserId || window._userId;
  const rows = body.map(row => ({ ...row, ...(userId ? { user_id: userId } : {}) }));
  const r = await fetch(`${SUPA_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...H(), 'Prefer': 'return=representation' },
    body: JSON.stringify(rows)
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`${r.status}: ${txt}`);
  return JSON.parse(txt);
}

async function sbDelete(table, id) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'DELETE',
    headers: H()
  });
  if (!r.ok) throw new Error(await r.text());
}

async function sbUpsert(table, body, onConflict) {
  const userId = window._adminViewUserId || window._userId;
  const rows = body.map(row => ({ ...row, ...(userId ? { user_id: userId } : {}) }));
  const r = await fetch(`${SUPA_URL}/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: 'POST',
    headers: { ...H(), 'Prefer': 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(rows)
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`${r.status}: ${txt}`);
  return JSON.parse(txt);
}
