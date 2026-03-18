// ── Shared app state ─────────────────────────────────────────
let categories = [];
let transactions = [];
let budgets = { weekly: {}, monthly: {} };
let period = 'weekly';
let periodTx = 'weekly';
let budgetTab = 'weekly';
let selectedCat = null;
let weekOffset = 0;
let reviewItems = [];
let selectedEmoji = '🏷️';
let selectedColor = { color: '#2D5A3D', bg: '#E8F0EA' };

// ── Constants ─────────────────────────────────────────────────
const EMOJI_OPTIONS = [
  '🛒','☕','🚌','🛍️','🏠','🎬','💊','💰','🍔','🍕',
  '✈️','🎮','📱','💇','🏋️','🐶','👶','🎓','💼','🚗',
  '⛽','🎁','🌿','🍷','🏖️','🎵','📚','🏥','💈','🧴'
];
const COLOR_OPTIONS = [
  { color: '#2D5A3D', bg: '#E8F0EA' },
  { color: '#8B4513', bg: '#FAF0EB' },
  { color: '#1B5E9E', bg: '#E6F1FB' },
  { color: '#6B3FA0', bg: '#F0EBFA' },
  { color: '#C4622D', bg: '#FAF0EB' },
  { color: '#B5398B', bg: '#FAE8F5' },
  { color: '#1B7A6E', bg: '#E3F5F3' },
  { color: '#7A6200', bg: '#FAF3D9' },
  { color: '#A32D2D', bg: '#FCEBEB' },
  { color: '#1A5276', bg: '#D6EAF8' },
  { color: '#4A235A', bg: '#F5EEF8' },
  { color: '#1E8449', bg: '#D5F5E3' },
];

// ── Helpers ───────────────────────────────────────────────────
function today() { return new Date().toISOString().slice(0, 10); }

function currentMonth() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
}

function getWeekRange(offset = 0) {
  const now = new Date(), mon = new Date(now);
  mon.setDate(now.getDate() - ((now.getDay() + 6) % 7) + offset * 7);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return { start: mon.toISOString().slice(0, 10), end: sun.toISOString().slice(0, 10), monDate: mon, sunDate: sun };
}

function inWeek(date, offset = 0) {
  const r = getWeekRange(offset);
  return date >= r.start && date <= r.end;
}

function inMonth(date) { return date && date.startsWith(currentMonth()); }

function filteredTx(p, wkOff = 0) {
  return transactions.filter(t => p === 'weekly' ? inWeek(t.date, wkOff) : inMonth(t.date));
}

function catById(id) {
  return categories.find(c => c.id === id) || categories[0] || { icon: '💳', bg: '#F0F0F0', color: '#666', name: 'Other' };
}

function catSpent(catId, p) {
  return filteredTx(p, 0).filter(t => t.category_id === catId).reduce((s, t) => s + Number(t.amount), 0);
}

function totalSpent(p) { return filteredTx(p, 0).reduce((s, t) => s + Number(t.amount), 0); }

function totalBudget(p) { return Object.values(budgets[p] || {}).reduce((s, v) => s + Number(v), 0); }

function fmt(n) { return '$' + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// ── Sync bar ──────────────────────────────────────────────────
let syncTimer;
function showSync(state, msg) {
  const bar = document.getElementById('sync-bar');
  const txt = document.getElementById('sync-msg');
  const retry = document.getElementById('sync-retry');
  bar.className = 'sync-bar ' + state;
  txt.textContent = msg;
  retry.style.display = state === 'err' ? 'inline' : 'none';
  clearTimeout(syncTimer);
  if (state === 'ok') syncTimer = setTimeout(() => bar.className = 'sync-bar hidden', 2500);
}
