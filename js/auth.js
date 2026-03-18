// ── Auth state ────────────────────────────────────────────────
let currentUser = null;
let isAdmin = false;
let adminViewUserId = null;

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

// ── Auth-aware headers ────────────────────────────────────────
function userHeaders() {
  return {
    'Content-Type': 'application/json',
    'apikey': SUPA_KEY,
    'Authorization': 'Bearer ' + (window._authToken || SUPA_KEY)
  };
}

// ── Override global H with user token ────────────────────────
function refreshH() {
  window._H = userHeaders();
}

// ── OTP ──────────────────────────────────────────────────────
async function sendOTP(email) {
  const r = await fetch(`${SUPA_URL}/auth/v1/otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPA_KEY },
    body: JSON.stringify({ email, type: 'email', options: { shouldCreateUser: false } })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.msg || data.error_description || 'Failed to send code');
}

async function verifyOTP(email, token) {
  const r = await fetch(`${SUPA_URL}/auth/v1/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPA_KEY },
    body: JSON.stringify({ email, token, type: 'email' })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.msg || data.error_description || 'Invalid code');
  return data;
}

// ── Sign out ──────────────────────────────────────────────────
async function signOut() {
  await fetch(`${SUPA_URL}/auth/v1/logout`, {
    method: 'POST',
    headers: userHeaders()
  }).catch(() => {});
  storeSession(null);
  window._authToken = null;
  currentUser = null; isAdmin = false; adminViewUserId = null;
  showAuthScreen();
}

// ── Handle magic link callback (token in URL hash or query) ──
async function handleAuthCallback() {
  // Supabase puts tokens in the hash fragment
  const hash = window.location.hash;
  const query = window.location.search;
  if (!hash && !query) return null;
  // Try hash first, then query string
  const paramStr = hash ? hash.replace('#', '') : query.replace('?', '');
  const params = new URLSearchParams(paramStr);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  const expires_in = params.get('expires_in');
  if (!access_token) return null;
  const r = await fetch(`${SUPA_URL}/auth/v1/user`, {
    headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + access_token }
  });
  const user = await r.json();
  if (!r.ok) return null;
  const session = {
    access_token, refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + Number(expires_in || 3600),
    user
  };
  storeSession(session);
  window.history.replaceState({}, document.title, window.location.pathname);
  return session;
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
      headers: userHeaders(),
      body: JSON.stringify({})
    });
    if (!r.ok) return [];
    return await r.json();
  } catch (e) { return []; }
}

// ── Render admin bar ──────────────────────────────────────────
async function renderAdminBar() {
  const bar = document.getElementById('admin-bar');
  bar.style.display = 'flex';
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

// ── Init ──────────────────────────────────────────────────────
async function initAuth() {
  const callbackSession = await handleAuthCallback();
  const session = callbackSession || getStoredSession();
  if (!session) { showAuthScreen(); return; }
  currentUser = session.user;
  window._authToken = session.access_token;
  window._userId = session.user.id;  // used by sbInsert/sbUpsert
  window._adminViewUserId = null;
  isAdmin = await checkAdmin(session.access_token);
  showAppScreen();
  if (isAdmin) await renderAdminBar();
  await loadAll();
}

function showAuthScreen() {
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('app-screen').style.display = 'none';
}
function showAppScreen() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app-screen').style.display = 'block';
  if (currentUser) document.getElementById('user-email').textContent = currentUser.email;
}

// ── Login handlers ───────────────────────────────────────────
let _otpEmail = '';

async function handleSendOTP() {
  const email = document.getElementById('login-email').value.trim();
  if (!email) { alert('Please enter your email'); return; }
  const btn = document.getElementById('login-btn');
  btn.textContent = 'Sending…'; btn.disabled = true;
  try {
    await sendOTP(email);
    _otpEmail = email;
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('login-otp').style.display = 'block';
  } catch (e) {
    alert('Error: ' + e.message);
    btn.textContent = 'Send code'; btn.disabled = false;
  }
}

async function handleVerifyOTP() {
  const token = document.getElementById('otp-input').value.trim();
  if (!token || token.length !== 6) { alert('Please enter the 6-digit code'); return; }
  const btn = document.getElementById('otp-btn');
  btn.textContent = 'Verifying…'; btn.disabled = true;
  try {
    const data = await verifyOTP(_otpEmail, token);
    // Store session
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
    btn.textContent = 'Verify code'; btn.disabled = false;
  }
}

function resendOTP() {
  document.getElementById('login-otp').style.display = 'none';
  document.getElementById('login-form').style.display = 'block';
  document.getElementById('login-btn').textContent = 'Send code';
  document.getElementById('login-btn').disabled = false;
}
