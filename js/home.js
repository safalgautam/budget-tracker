function renderHome() {
  if (!categories.length) {
    document.getElementById('cat-list').innerHTML = '<div class="empty-state"><div class="empty-icon">📂</div><div class="empty-label">Add categories in Settings</div></div>';
    return;
  }

  const sp = totalSpent(period), bg = totalBudget(period), left = bg - sp;
  const pct = bg > 0 ? Math.min(100, Math.round(sp / bg * 100)) : 0;

  document.getElementById('sum-budget').textContent = fmt(bg);
  document.getElementById('sum-spent').textContent = fmt(sp);
  const le = document.getElementById('sum-left');
  le.textContent = fmt(Math.abs(left));
  le.className = 'sum-value ' + (left >= 0 ? 'good' : 'warn');

  document.getElementById('bp-pct').textContent = pct + '%';
  document.getElementById('bp-label').textContent = period === 'weekly' ? 'This week' : 'This month';
  const bar = document.getElementById('bp-bar');
  bar.style.width = pct + '%';
  bar.className = 'bar-fill' + (pct >= 100 ? ' over' : '');

  const now = new Date();
  if (period === 'weekly') {
    const r = getWeekRange(0);
    document.getElementById('hdr-eyebrow').textContent = fmtDate(r.start) + ' – ' + fmtDate(r.end);
    document.getElementById('hdr-title').textContent = 'This Week';
  } else {
    document.getElementById('hdr-eyebrow').textContent = now.toLocaleString('en-AU', { month: 'long', year: 'numeric' });
    document.getElementById('hdr-title').textContent = 'This Month';
  }
  document.getElementById('hdr-sub').textContent = left >= 0 ? fmt(left) + ' remaining' : fmt(Math.abs(left)) + ' over budget';

  document.getElementById('week-strip').style.display = period === 'weekly' ? 'block' : 'none';
  if (period === 'weekly') renderWeekStrip();

  document.getElementById('cat-list').innerHTML = categories.map(c => {
    const sp2 = catSpent(c.id, period), bg2 = Number(budgets[period]?.[c.id] || 0);
    const pct2 = bg2 > 0 ? Math.min(100, sp2 / bg2 * 100) : 0;
    const over = sp2 > bg2 && bg2 > 0;
    return `<div class="cat-card" onclick="openModalCat('${c.id}')">
      <div class="cat-icon" style="background:${c.bg}">${c.icon}</div>
      <div class="cat-info">
        <div class="cat-name">${c.name}</div>
        <div class="cat-bar-track"><div class="cat-bar-fill" style="width:${pct2}%;background:${over ? '#C4622D' : c.color}"></div></div>
      </div>
      <div class="cat-amounts">
        <div class="cat-spent" style="color:${over ? '#C4622D' : c.color}">${fmt(sp2)}</div>
        <div class="cat-budget">of ${fmt(bg2)}</div>
      </div>
    </div>`;
  }).join('');
}

function renderWeekStrip() {
  const r = getWeekRange(weekOffset), mon = r.monDate;
  const days = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  const amounts = days.map((_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    return transactions.filter(t => t.date === iso).reduce((s, t) => s + Number(t.amount), 0);
  });
  const maxA = Math.max(...amounts, 1), todayIso = today();

  document.getElementById('ws-dates').textContent =
    mon.toLocaleString('en-AU', { day: 'numeric', month: 'short' }) + ' – ' +
    r.sunDate.toLocaleString('en-AU', { day: 'numeric', month: 'short' });

  document.getElementById('ws-bars').innerHTML = days.map((d, i) => {
    const dt = new Date(mon);
    dt.setDate(mon.getDate() + i);
    const iso = dt.toISOString().slice(0, 10), amt = amounts[i];
    const h = Math.round((amt / maxA) * 46), isToday = iso === todayIso;
    return `<div class="ws-bar-col">
      <div class="ws-bar-wrap"><div class="ws-bar" style="height:${h}px;background:${isToday ? '#2D5A3D' : '#B4D4C0'}"></div></div>
      <div class="ws-day-label" style="color:${isToday ? '#2D5A3D' : '#9E9994'};font-weight:${isToday ? 500 : 400}">${d}</div>
    </div>`;
  }).join('');
}

function shiftWeek(dir) {
  weekOffset += dir;
  if (weekOffset > 0) weekOffset = 0;
  renderWeekStrip();
}

function setPeriod(p) {
  period = p;
  document.getElementById('pt-weekly').className = 'pt-btn' + (p === 'weekly' ? ' active' : '');
  document.getElementById('pt-monthly').className = 'pt-btn' + (p === 'monthly' ? ' active' : '');
  renderHome();
}
