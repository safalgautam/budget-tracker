function renderBudgetForm() {
  let total = 0;
  document.getElementById('budget-form').innerHTML = categories.map(c => {
    const v = Number(budgets[budgetTab]?.[c.id] || 0); total += v;
    return `<div class="budget-item">
      <div class="budget-icon">${c.icon}</div>
      <div class="budget-name">${c.name}</div>
      <input class="budget-input" type="number" id="bi-${c.id}" value="${v}" inputmode="decimal" onchange="updateTotal()">
    </div>`;
  }).join('');
  document.getElementById('total-label').textContent = `Total ${budgetTab} budget`;
  document.getElementById('total-val').textContent = fmt(total);
}

function updateTotal() {
  let t = 0;
  categories.forEach(c => { t += parseFloat(document.getElementById('bi-' + c.id)?.value || 0); });
  document.getElementById('total-val').textContent = fmt(t);
}

async function saveBudgets() {
  if (!budgets[budgetTab]) budgets[budgetTab] = {};
  categories.forEach(c => { budgets[budgetTab][c.id] = parseFloat(document.getElementById('bi-' + c.id)?.value || 0); });
  showSync('syncing', 'Saving budgets…');
  try {
    const rows = categories.map(c => ({ period: budgetTab, category: c.id, amount: budgets[budgetTab][c.id] }));
    await sbUpsert('budgets', rows, 'period,category');
    showSync('ok', 'Budgets saved');
    renderHome();
  } catch (e) { showSync('err', 'Save failed'); }
}

function setBudgetTab(p) {
  budgetTab = p;
  document.getElementById('bpr-weekly').className = 'bpr-btn' + (p === 'weekly' ? ' active' : '');
  document.getElementById('bpr-monthly').className = 'bpr-btn' + (p === 'monthly' ? ' active' : '');
  renderBudgetForm();
}
