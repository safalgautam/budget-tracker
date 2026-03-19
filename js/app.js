// ── Page navigation ───────────────────────────────────────────
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  document.getElementById('nav-' + name).classList.add('active');
  document.getElementById('add-fab').style.display = name === 'home' ? 'flex' : 'none';
  if (name === 'settings') renderSettings();
  if (name === 'tx') renderTransactions();
}

function renderSettings() {
  renderCategoryManager();
  renderBudgetForm();
}

// ── Load data via RPC (admin bypass) ─────────────────────────
async function rpcGetUserData(targetUserId, dataType) {
  const r = await fetch(`${SUPA_URL}/rest/v1/rpc/get_user_data`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPA_KEY,
      'Authorization': 'Bearer ' + window._authToken
    },
    body: JSON.stringify({ target_user_id: targetUserId, data_type: dataType })
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`${r.status}: ${txt}`);
  const result = JSON.parse(txt);
  return result || [];
}

// ── Load all data ─────────────────────────────────────────────
async function loadAll() {
  showSync('syncing', 'Loading…');
  try {
    const past = new Date(); past.setMonth(past.getMonth() - 2);
    const fromDate = past.toISOString().slice(0, 10);

    let catData = [], txData = [], bgData = [];

    if (window._adminViewUserId) {
      // Admin viewing another user — use RPC to bypass RLS
      try { catData = await rpcGetUserData(window._adminViewUserId, 'categories'); }
      catch (e) { throw new Error('categories: ' + e.message); }
      try { txData = await rpcGetUserData(window._adminViewUserId, 'transactions'); }
      catch (e) { throw new Error('transactions: ' + e.message); }
      try { bgData = await rpcGetUserData(window._adminViewUserId, 'budgets'); }
      catch (e) { throw new Error('budgets: ' + e.message); }
    } else {
      // Normal user — use RLS filtered queries
      try { catData = await sbGetAsUser('categories', 'order=created_at.asc'); }
      catch (e) { throw new Error('categories: ' + e.message); }
      try { txData = await sbGetAsUser('transactions', `date=gte.${fromDate}&order=date.desc,created_at.desc`); }
      catch (e) { throw new Error('transactions: ' + e.message); }
      try { bgData = await sbGetAsUser('budgets', 'select=period,category,amount'); }
      catch (e) { throw new Error('budgets: ' + e.message); }
    }

    categories = catData || [];
    transactions = txData || [];
    budgets = { weekly: {}, monthly: {} };
    if (bgData && bgData.length) {
      bgData.forEach(r => {
        if (!budgets[r.period]) budgets[r.period] = {};
        budgets[r.period][r.category] = Number(r.amount);
      });
    }
    if (!selectedCat && categories.length) selectedCat = categories[0].id;
    showSync('ok', 'Synced');
  } catch (e) {
    console.error('loadAll failed:', e);
    showSync('err', e.message.slice(0, 80));
  }
  renderHome();
  renderTransactions();
}

// ── Init ──────────────────────────────────────────────────────
initAuth();
