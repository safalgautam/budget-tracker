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

// ── API calls ─────────────────────────────────────────────────
async function signInWithPassword(email, password) {
  const r = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPA_KEY },
    body: JSON.stringify({ email, password })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error_description || data.msg || 'Invalid email or password');
  return data;
}

async function sendPasswordReset(email) {
  const redirectTo = window.location.origin + window.location.pathname;
  const r = await fetch(`${SUPA_URL}/auth/v1/recover`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPA_KEY },
    body: JSON.stringify({ email, gotrue_meta_security: {}, options: { emailRedirectTo: redirectTo } })
  });
  if (!r.ok) {
    const d = await r.json();
    throw new Error(d.error_description || d.msg || 'Failed to send reset email');
  }
}

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
  if (!r.ok) throw new Error(data.error_description || data.msg || 'Failed to update password');
  return data;
}

async function signOut() {
  await fetch(`${SUPA_URL}/auth/v1/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + window._authToken }
  }).catch(() => {});
  storeSession(null);
  window._authToken = null;
  window._userId = null;
  window._adminViewUserId = null;
  currentUser = null;
  isAdmin = false;
  showScreen('login');
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

// ── Admin bar ─────────────────────────────────────────────────
async function loadAdminUserList() {
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/rpc/list_users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + window._authToken },
      body: JSON.stringify({})
    });
    if (!r.ok) return [];
    return await r.json();
  } catch (e) { return []; }
}

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
    ? 'Viewing: ' + select.options[select.selectedIndex].text : '';
  await loadAll();
}

// ── Screen management ─────────────────────────────────────────
// Screens: 'login', 'forgot', 'reset', 'app'
function showScreen(name) {
  document.getElementById('auth-screen').style.display = name !== 'app' ? 'flex' : 'none';
  document.getElementById('app-screen').style.display = name === 'app' ? 'block' : 'none';
  document.getElementById('screen-login').style.display = name === 'login' ? 'block' : 'none';
  document.getElementById('screen-forgot').style.display = name === 'forgot' ? 'block' : 'none';
  document.getElementById('screen-reset').style.display = name === 'reset' ? 'block' : 'none';
  if (name === 'login') {
    document.getElementById('login-email').value = '';
    document.getElementById('login-password').value = '';
    document.getElementById('login-btn').textContent = 'Sign in';
    document.getElementById('login-btn').disabled = false;
  }
  if (name === 'app' && currentUser) {
    document.getElementById('user-email').textContent = currentUser.email;
  }
}

// ── Handlers ──────────────────────────────────────────────────
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
    showScreen('app');
    if (isAdmin) await renderAdminBar();
    await loadAll();
  } catch (e) {
    alert(e.message);
    btn.textContent = 'Sign in';
    btn.disabled = false;
  }
}

async function handleForgotPassword() {
  const email = document.getElementById('forgot-email').value.trim();
  if (!email) { alert('Please enter your email'); return; }
  const btn = document.getElementById('forgot-btn');
  btn.textContent = 'Sending…'; btn.disabled = true;
  try {
    await sendPasswordReset(email);
    // Store email so we can use it when verifying the reset token
    localStorage.setItem('reset_email', email);
    document.getElementById('forgot-sent').style.display = 'block';
    document.getElementById('forgot-form-inner').style.display = 'none';
  } catch (e) {
    alert(e.message);
    btn.textContent = 'Send reset email';
    btn.disabled = false;
  }
}

async function handleSetNewPassword() {
  const newPass = document.getElementById('reset-password').value;
  const confirm = document.getElementById('reset-confirm').value;
  if (!newPass || newPass.length < 6) { alert('Password must be at least 6 characters'); return; }
  if (newPass !== confirm) { alert('Passwords do not match'); return; }
  const btn = document.getElementById('reset-btn');
  btn.textContent = 'Saving…'; btn.disabled = true;
  try {
    await updatePassword(newPass);
    // Store session and go to app
    const session = {
      access_token: window._authToken,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: currentUser
    };
    storeSession(session);
    window._userId = currentUser.id;
    window._adminViewUserId = null;
    isAdmin = await checkAdmin(window._authToken);
    showScreen('app');
    if (isAdmin) await renderAdminBar();
    await loadAll();
  } catch (e) {
    alert(e.message);
    btn.textContent = 'Set password';
    btn.disabled = false;
  }
}

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
  } catch (e) { alert(e.message); }
  btn.textContent = 'Update password';
  btn.disabled = false;
}

// ── Init ──────────────────────────────────────────────────────
async function initAuth() {
  // Check for recovery token in query string (?token=xxx&type=recovery)
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const type = params.get('type');

  if (token && type === 'recovery') {
    // Clean the URL immediately
    window.history.replaceState({}, document.title, window.location.pathname);
    // Verify the OTP token to get a session
    try {
      const r = await fetch(`${SUPA_URL}/auth/v1/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPA_KEY },
        body: JSON.stringify({ token, type: 'recovery', email: localStorage.getItem('reset_email') || '' })
      });
      const data = await r.json();
      if (r.ok && data.access_token) {
        window._authToken = data.access_token;
        currentUser = data.user;
        showScreen('reset');
        return;
      } else {
        console.error('Recovery verify failed:', data);
        alert('Reset link is invalid or expired. Please request a new one.');
        showScreen('login');
        return;
      }
    } catch (e) {
      console.error('Recovery error:', e);
      showScreen('login');
      return;
    }
  }

  // Check stored session
  const session = getStoredSession();
  if (!session) { showScreen('login'); return; }
  currentUser = session.user;
  window._authToken = session.access_token;
  window._userId = session.user.id;
  window._adminViewUserId = null;
  isAdmin = await checkAdmin(session.access_token);
  showScreen('app');
  if (isAdmin) await renderAdminBar();
  await loadAll();
}
