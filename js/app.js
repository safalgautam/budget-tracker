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

// ── Settings page ─────────────────────────────────────────────
function renderSettings() {
  renderCategoryManager();
  renderBudgetForm();
}

// ── Load all data from Supabase ───────────────────────────────
async function loadAll() {
  showSync('syncing', 'Loading…');
  try {
    const past = new Date(); past.setMonth(past.getMonth() - 2);
    const fromDate = past.toISOString().slice(0, 10);

    let catData = [], txData = [], bgData = [];
    try { catData = await sbGet('categories', 'order=created_at.asc'); }
    catch (e) { throw new Error('categories: ' + e.message); }
    try { txData = await sbGet('transactions', `date=gte.${fromDate}&order=date.desc,created_at.desc`); }
    catch (e) { throw new Error('transactions: ' + e.message); }
    try { bgData = await sbGet('budgets', 'select=period,category,amount'); }
    catch (e) { throw new Error('budgets: ' + e.message); }

    categories = catData || [];
    transactions = txData || [];
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
loadAll();
