function renderCategoryManager() {
  document.getElementById('cat-manage-list').innerHTML = categories.map(c => `
    <div class="cat-manage-item">
      <div class="cat-manage-icon">${c.icon}</div>
      <div class="cat-manage-name">${c.name}</div>
      <div class="cat-manage-actions">
        <button class="cat-action-btn" onclick="deleteCategory('${c.id}')" title="Delete">🗑️</button>
      </div>
    </div>`).join('');

  // Emoji grid
  document.getElementById('emoji-grid').innerHTML = EMOJI_OPTIONS.map(e =>
    `<button class="emoji-btn${e === selectedEmoji ? ' selected' : ''}" onclick="pickEmoji('${e}')">${e}</button>`
  ).join('');

  // Color grid
  document.getElementById('color-grid').innerHTML = COLOR_OPTIONS.map((c, i) =>
    `<div class="color-swatch${c.color === selectedColor.color ? ' selected' : ''}" style="background:${c.color}" onclick="pickColor(${i})"></div>`
  ).join('');
}

function toggleAddCatForm() {
  const f = document.getElementById('cat-add-form');
  f.style.display = f.style.display === 'none' ? 'block' : 'none';
}

function pickEmoji(e) {
  selectedEmoji = e;
  document.querySelectorAll('.emoji-btn').forEach(b => b.classList.toggle('selected', b.textContent === e));
}

function pickColor(i) {
  selectedColor = COLOR_OPTIONS[i];
  document.querySelectorAll('.color-swatch').forEach((s, j) => s.classList.toggle('selected', j === i));
}

async function saveNewCategory() {
  const name = document.getElementById('new-cat-name').value.trim();
  if (!name) { alert('Please enter a category name'); return; }
  showSync('syncing', 'Saving category…');
  try {
    const rows = await sbInsert('categories', [{ name, icon: selectedEmoji, color: selectedColor.color, bg: selectedColor.bg }]);
    categories.push(rows[0]);
    if (!selectedCat) selectedCat = rows[0].id;
    document.getElementById('new-cat-name').value = '';
    document.getElementById('cat-add-form').style.display = 'none';
    renderSettings();
    renderHome();
    showSync('ok', 'Category added');
  } catch (e) { showSync('err', 'Failed: ' + e.message.slice(0, 50)); }
}

async function deleteCategory(id) {
  if (!confirm('Delete this category? Transactions using it will lose their category.')) return;
  showSync('syncing', 'Deleting…');
  try {
    await sbDelete('categories', id);
    categories = categories.filter(c => c.id !== id);
    if (selectedCat === id) selectedCat = categories[0]?.id || null;
    renderSettings();
    renderHome();
    showSync('ok', 'Category deleted');
  } catch (e) { showSync('err', 'Failed: ' + e.message.slice(0, 50)); }
}
