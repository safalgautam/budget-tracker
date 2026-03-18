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
  const redirectTo = 'https://safalgautam.github.io/budget-tracker/#recovery';
  const r = await fetch(`${SUPA_URL}/auth/v1/recover`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPA_KEY },
    body: JSON.stringify({ email, options: { emailRedirectTo: redirectTo } })
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

async function renderAdminBar() {
  document.getElementById('admin-bar').style.display = 'flex';
  const users = await loadAdminUserList();
  const select = document.getElementById('admin-user-select');
  select.innerHTML = '<option value="">My data</option>' +
    users.filter(u => u.id !== currentUser.id).map(u =>
      '<option value="' + u.id + '">' + u.email + '</option>'
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
function showScreen(name) {
  const isApp = name === 'app';
  document.getElementById('auth-screen').style.display = isApp ? 'none' : 'flex';
  document.getElementById('app-screen').style.display = isApp ? 'block' : 'none';
  document.getElementById('screen-login').style.display = name === 'login' ? 'block' : 'none';
  document.getElementById('screen-forgot').style.display = name === 'forgot' ? 'block' : 'none';
  document.getElementById('screen-reset').style.display = name === 'reset' ? 'block' : 'none';
  if (name === 'login') {
    document.getElementById('login-email').value = '';
    document.getElementById('login-password').value = '';
    document.getElementById('login-btn').textContent = 'Sign in';
    document.getElementById('login-btn').disabled = false;
  }
  if (name === 'forgot') {
    document.getElementById('forgot-form-inner').style.display = 'block';
    document.getElementById('forgot-sent').style.display = 'none';
    document.getElementById('forgot-btn').textContent = 'Send reset email';
    document.getElementById('forgot-btn').disabled = false;
  }
  if (isApp && currentUser) {
    document.getElementById('user-email').textContent = currentUser.email;
  }
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
    showScreen('app');
    if (isAdmin) await renderAdminBar();
    await loadAll();
  } catch (e) {
    alert(e.message);
    btn.textContent = 'Sign in';
    btn.disabled = false;
  }
}

// ── Forgot password handler ───────────────────────────────────
async function handleForgotPassword() {
  const email = document.getElementById('forgot-email').value.trim();
  if (!email) { alert('Please enter your email'); return; }
  const btn = document.getElementById('forgot-btn');
  btn.textContent = 'Sending…'; btn.disabled = true;
  try {
    await sendPasswordReset(email);
    document.getElementById('forgot-sent').style.display = 'block';
    document.getElementById('forgot-form-inner').style.display = 'none';
  } catch (e) {
    alert(e.message);
    btn.textContent = 'Send reset email';
    btn.disabled = false;
  }
}

// ── Reset password handler ────────────────────────────────────
async function handleSetNewPassword() {
  const newPass = document.getElementById('reset-password').value;
  const confirm = document.getElementById('reset-confirm').value;
  if (!newPass || newPass.length < 6) { alert('Password must be at least 6 characters'); return; }
  if (newPass !== confirm) { alert('Passwords do not match'); return; }
  const btn = document.getElementById('reset-btn');
  btn.textContent = 'Saving…'; btn.disabled = true;
  try {
    await updatePassword(newPass);
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
  } catch (e) { alert(e.message); }
  btn.textContent = 'Update password';
  btn.disabled = false;
}

// ── Parse recovery token from any URL string ─────────────────
function getRecoveryToken(url) {
  url = url || window.location.href;
  // Look for #recovery?token_hash=xxx in the URL
  const hashIndex = url.indexOf('#recovery');
  if (hashIndex === -1) return null;
  const hashContent = url.substring(hashIndex + 1); // recovery?token_hash=xxx
  const qIndex = hashContent.indexOf('?');
  if (qIndex === -1) return null;
  const params = new URLSearchParams(hashContent.substring(qIndex + 1));
  return params.get('token_hash');
}

// ── Init ──────────────────────────────────────────────────────
async function initAuth() {
  // Check sessionStorage for a redirect URL saved by 404.html
  const redirectUrl = sessionStorage.getItem('redirect_url');
  if (redirectUrl) sessionStorage.removeItem('redirect_url');

  // Try to get recovery token from either the current URL or the stored redirect URL
  const token_hash = getRecoveryToken(window.location.href) || getRecoveryToken(redirectUrl || '');

  if (token_hash) {
    // Clean URL
    window.history.replaceState({}, document.title, window.location.pathname);
    try {
      const r = await fetch(`${SUPA_URL}/auth/v1/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPA_KEY },
        body: JSON.stringify({ token_hash, type: 'recovery' })
      });
      const data = await r.json();
      if (r.ok && data.access_token) {
        window._authToken = data.access_token;
        currentUser = data.user;
        showScreen('reset');
        return;
      } else {
        alert('Reset link error: ' + (data.error_description || data.msg || JSON.stringify(data)));
      }
    } catch (e) {
      alert('Reset error: ' + e.message);
    }
    showScreen('login');
    return;
  }

  // Normal login — check stored session
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
