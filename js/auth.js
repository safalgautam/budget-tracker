// ── Auth state ────────────────────────────────────────────────
let currentUser = null;
let isAdmin = false;

// ── Session storage ───────────────────────────────────────────
function getStoredSession() {
  try {
    const raw = localStorage.getItem('sb_session');
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (s.expires_at && Date.now() / 1000 > s.expires_at) {
      localStorage.removeItem('sb_session');
      return null;
    }
    return s;
  } catch (e) { return null; }
}
function storeSession(s) {
  if (s) localStorage.setItem('sb_session', JSON.stringify(s));
  else localStorage.removeItem('sb_session');
}

// ── Sign in with email + password ─────────────────────────────
async function signInWithPassword(email, password) {
  const r = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPA_KEY },
    body: JSON.stringify({ email, password })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.msg || data.error_description || 'Invalid email or password');
  return data;
}

// ── Update password ───────────────────────────────────────────
async function updatePassword(newPassword) {
  const r = await fetch(`${SUPA_URL}/auth/v1/user`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPA_KEY,
      'Authorization': 'Bearer ' + window._authToken
    },
    body: JSON.stringify({ password: newPassword })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.msg || data.error_description || 'Failed to update password');
  return data;
}

// ── Sign out ──────────────────────────────────────────────────
async function signOut() {
  await fetch(`${SUPA_URL}/auth/v1/logout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPA_KEY,
      'Authorization': 'Bearer ' + window._authToken
    }
  }).catch(() => {});
  storeSession(null);
  window._authToken = null;
  window._userId = null;
  window._adminViewUserId = null;
  currentUser = null;
  isAdmin = false;
  showAuthScreen();
}

// ── Check admin ───────────────────────────────────────────────
async function checkAdmin(token) {
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/admins?select=user_id&limit=1`, {
      headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + token }
    });
    const d = await r.json();
    return Array.isArray(d) && d.length > 0;
  } catch (e) { return false; }
}

// ── Load users for admin view ─────────────────────────────────
async function loadAdminUserList() {
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/rpc/list_users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPA_KEY,
        'Authorization': 'Bearer ' + window._authToken
      },
      body: JSON.stringify({})
    });
    if (!r.ok) return [];
    return await r.json();
  } catch (e) { return []; }
}

// ── Render admin bar ──────────────────────────────────────────
async function renderAdminBar() {
  document.getElementById('admin-bar').style.display = 'flex';
  const users = await loadAdminUserList();
  const select = document.getElementById('admin-user-select');
  select.innerHTML = `<option value="">My data</option>` +
    users.filter(u => u.id !== currentUser.id).map(u =>
      `<option value="${u.id}">${u.email}</option>`
    ).join('');
}

async function switchAdminUser() {
  const select = document.getElementById('admin-user-select');
  window._adminViewUserId = select.value || null;
  document.getElementById('admin-viewing').textContent = window._adminViewUserId
    ? 'Viewing: ' + select.options[select.selectedIndex].text
    : '';
  await loadAll();
}

// ── Show/hide screens ─────────────────────────────────────────
function showAuthScreen() {
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('app-screen').style.display = 'none';
  // Reset form state
  document.getElementById('login-email').value = '';
  document.getElementById('login-password').value = '';
  document.getElementById('login-btn').textContent = 'Sign in';
  document.getElementById('login-btn').disabled = false;
}

function showAppScreen() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app-screen').style.display = 'block';
  if (currentUser) document.getElementById('user-email').textContent = currentUser.email;
}

// ── Login handler ─────────────────────────────────────────────
async function handleSignIn() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  if (!email || !password) { alert('Please enter your email and password'); return; }
  const btn = document.getElementById('login-btn');
  btn.textContent = 'Signing in…'; btn.disabled = true;
  try {
    const data = await signInWithPassword(email, password);
    const session = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + Number(data.expires_in || 3600),
      user: data.user
    };
    storeSession(session);
    currentUser = session.user;
    window._authToken = session.access_token;
    window._userId = session.user.id;
    window._adminViewUserId = null;
    isAdmin = await checkAdmin(session.access_token);
    showAppScreen();
    if (isAdmin) await renderAdminBar();
    await loadAll();
  } catch (e) {
    alert('Error: ' + e.message);
    btn.textContent = 'Sign in';
    btn.disabled = false;
  }
}

// ── Change password handler ───────────────────────────────────
async function handleChangePassword() {
  const newPass = document.getElementById('new-password').value;
  const confirm = document.getElementById('confirm-password').value;
  if (!newPass || newPass.length < 6) { alert('Password must be at least 6 characters'); return; }
  if (newPass !== confirm) { alert('Passwords do not match'); return; }
  const btn = document.getElementById('change-pass-btn');
  btn.textContent = 'Saving…'; btn.disabled = true;
  try {
    await updatePassword(newPass);
    document.getElementById('new-password').value = '';
    document.getElementById('confirm-password').value = '';
    alert('Password updated successfully');
  } catch (e) { alert('Error: ' + e.message); }
  btn.textContent = 'Update password';
  btn.disabled = false;
}

// ── Init ──────────────────────────────────────────────────────
async function initAuth() {
  const session = getStoredSession();
  if (!session) { showAuthScreen(); return; }
  currentUser = session.user;
  window._authToken = session.access_token;
  window._userId = session.user.id;
  window._adminViewUserId = null;
  isAdmin = await checkAdmin(session.access_token);
  showAppScreen();
  if (isAdmin) await renderAdminBar();
  await loadAll();
}
