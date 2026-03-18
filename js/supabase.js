const SUPA_URL = 'https://afobsnqtywtlupqjimaz.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmb2JzbnF0eXd0bHVwcWppbWF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzA0NTIsImV4cCI6MjA4OTQwNjQ1Mn0.MWrWZkZD8fkDa9HCLQUCwPcBm4zmNuWDGWyXMUr77BM';
const H = {
  'Content-Type': 'application/json',
  'apikey': SUPA_KEY,
  'Authorization': 'Bearer ' + SUPA_KEY
};

async function sbGet(table, params = '') {
  const url = `${SUPA_URL}/rest/v1/${table}${params ? '?' + params : ''}`;
  const r = await fetch(url, { headers: { ...H, 'Accept': 'application/json' } });
  const txt = await r.text();
  if (!r.ok) throw new Error(`${r.status}: ${txt}`);
  return JSON.parse(txt);
}

async function sbInsert(table, body) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...H, 'Prefer': 'return=representation' },
    body: JSON.stringify(body)
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`${r.status}: ${txt}`);
  return JSON.parse(txt);
}

async function sbDelete(table, id) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'DELETE',
    headers: H
  });
  if (!r.ok) throw new Error(await r.text());
}

async function sbUpsert(table, body, onConflict) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: 'POST',
    headers: { ...H, 'Prefer': 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(body)
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`${r.status}: ${txt}`);
  return JSON.parse(txt);
}
