function renderTransactions() {
  const txs = filteredTx(periodTx).slice();
  document.getElementById('tx-title').textContent = periodTx === 'weekly' ? 'This Week' : 'This Month';
  document.getElementById('tx-section-label').textContent = txs.length + ' transaction' + (txs.length !== 1 ? 's' : '');
  const el = document.getElementById('tx-list');
  if (!txs.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">🧾</div><div class="empty-label">No transactions yet</div></div>';
    return;
  }
  el.innerHTML = txs.map(t => {
    const cat = catById(t.category_id);
    return `<div class="tx-item">
      <div class="tx-icon" style="background:${cat.bg}">${cat.icon}</div>
      <div class="tx-info">
        <div class="tx-merchant">${t.merchant || cat.name}</div>
        <div class="tx-meta">${fmtDate(t.date)} · <span class="chip">${cat.name}</span></div>
      </div>
      <div style="display:flex;align-items:center;gap:6px">
        <div class="tx-amount">${fmt(t.amount)}</div>
        <button class="tx-delete" onclick="deleteTx('${t.id}')">×</button>
      </div>
    </div>`;
  }).join('');
}

// ── Add expense modal ─────────────────────────────────────────
function buildPicker() {
  document.getElementById('cat-picker').innerHTML = categories.map(c =>
    `<button class="cat-pick-btn ${c.id === selectedCat ? 'selected' : ''}" onclick="selCat('${c.id}')">
      <span class="cat-pick-icon">${c.icon}</span>${c.name.split(' ')[0]}
    </button>`).join('');
}

function selCat(id) { selectedCat = id; buildPicker(); }

function openModal() {
  document.getElementById('inp-amount').value = '';
  document.getElementById('inp-merchant').value = '';
  document.getElementById('inp-date').value = today();
  buildPicker();
  document.getElementById('modal').classList.add('open');
}

function openModalCat(id) { selectedCat = id; openModal(); }
function closeModal() { document.getElementById('modal').classList.remove('open'); }
function closeOuter(e) { if (e.target.id === 'modal') closeModal(); }

async function addExpense() {
  const amount = parseFloat(document.getElementById('inp-amount').value);
  const merchant = document.getElementById('inp-merchant').value.trim();
  const date = document.getElementById('inp-date').value;
  if (!amount || amount <= 0) { alert('Please enter a valid amount'); return; }
  if (!selectedCat) { alert('Please select a category'); return; }
  const btn = document.getElementById('submit-btn');
  btn.textContent = 'Saving…'; btn.disabled = true;
  showSync('syncing', 'Saving…');
  try {
    const rows = await sbInsert('transactions', [{ amount, merchant, category_id: selectedCat, date }]);
    transactions.unshift(rows[0]);
    closeModal(); renderHome(); renderTransactions();
    showSync('ok', 'Expense saved');
  } catch (e) {
    console.error(e);
    showSync('err', e.message.slice(0, 80));
  }
  btn.textContent = 'Add expense'; btn.disabled = false;
}

async function deleteTx(id) {
  showSync('syncing', 'Deleting…');
  try {
    await sbDelete('transactions', id);
    transactions = transactions.filter(t => t.id !== id);
    renderHome(); renderTransactions();
    showSync('ok', 'Deleted');
  } catch (e) { showSync('err', 'Delete failed'); }
}

function setPeriodTx(p) {
  periodTx = p;
  document.getElementById('pt-weekly-tx').className = 'pt-btn' + (p === 'weekly' ? ' active' : '');
  document.getElementById('pt-monthly-tx').className = 'pt-btn' + (p === 'monthly' ? ' active' : '');
  renderTransactions();
}
