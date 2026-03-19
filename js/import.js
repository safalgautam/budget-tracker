try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
} catch (e) { console.warn('PDF.js worker not set:', e); }

function handleDrop(e) {
  e.preventDefault();
  document.getElementById('pdf-drop').classList.remove('drag');
  const file = e.dataTransfer.files[0];
  if (file && file.type === 'application/pdf') handleFile(file);
  else alert('Please drop a PDF file');
}

async function handleFile(file) {
  if (!file) return;
  document.getElementById('pdf-progress').style.display = 'block';
  setProgress(10, 'Reading PDF…');
  try {
    const arrayBuffer = await file.arrayBuffer();
    setProgress(30, 'Extracting text…');
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      fullText += content.items.map(s => s.str).join(' ') + '\n';
      setProgress(30 + Math.round((i / pdf.numPages) * 30), `Reading page ${i} of ${pdf.numPages}…`);
    }
    setProgress(65, 'Parsing transactions with AI…');
    const parsed = await parseWithAI(fullText);
    setProgress(100, 'Done!');
    setTimeout(() => {
      document.getElementById('pdf-progress').style.display = 'none';
      showReview(parsed);
    }, 400);
  } catch (e) {
    console.error(e);
    document.getElementById('pdf-progress').style.display = 'none';
    alert('Could not read PDF: ' + e.message);
  }
}

function setProgress(pct, label) {
  document.getElementById('pdf-progress-fill').style.width = pct + '%';
  document.getElementById('pdf-progress-label').textContent = label;
}

async function parseWithAI(text) {
  const catNames = categories.map(c => c.name).join(', ');
  const prompt = `You are parsing a Westpac bank statement. Extract all debit/expense transactions (ignore credits, transfers to self, interest).

For each transaction return JSON with: date (YYYY-MM-DD), merchant (clean short name), amount (positive number).

Available categories: ${catNames}

Statement text (first 6000 chars):
${text.slice(0, 6000)}

Return ONLY a JSON array of objects. No markdown, no explanation. Example:
[{"date":"2026-03-01","merchant":"Woolworths","amount":45.20},{"date":"2026-03-02","merchant":"Shell","amount":80.00}]`;

  // Use Supabase Edge Function as proxy to avoid CORS issues
  const proxyUrl = `${SUPA_URL}/functions/v1/claude-proxy`;
  const res = await fetch(proxyUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + (window._authToken || SUPA_KEY),
      'apikey': SUPA_KEY
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'AI parsing failed');
  const raw = data.content.map(b => b.text || '').join('').replace(/```json|```/g, '').trim();
  return JSON.parse(raw);
}

function showReview(items) {
  reviewItems = items.map(item => ({ ...item, category_id: selectedCat || categories[0]?.id, skip: false }));
  document.getElementById('drop-zone-wrap').style.display = 'none';
  document.getElementById('review-wrap').style.display = 'block';
  document.getElementById('review-count').textContent = reviewItems.length + ' transactions found';
  renderReview();
}

function renderReview() {
  document.getElementById('review-list').innerHTML = reviewItems.map((item, i) => {
    if (item.skip) return `<div class="review-item" style="opacity:.4">
      <div class="review-top">
        <div><div class="review-merchant" style="text-decoration:line-through">${item.merchant}</div>
        <div class="review-meta">${fmtDate(item.date)}</div></div>
        <div class="review-amount">${fmt(item.amount)}</div>
      </div>
      <div style="font-size:12px;color:var(--ink3)">Skipped — <span style="cursor:pointer;text-decoration:underline" onclick="toggleSkip(${i})">undo</span></div>
    </div>`;
    return `<div class="review-item">
      <div class="review-top">
        <div><div class="review-merchant">${item.merchant}</div><div class="review-meta">${fmtDate(item.date)}</div></div>
        <div class="review-amount">${fmt(item.amount)}</div>
      </div>
      <div class="review-cat-pick">${categories.map(c => `
        <button class="review-cat-btn${item.category_id === c.id ? ' selected' : ''}" onclick="setReviewCat(${i},'${c.id}')">
          <span class="review-cat-icon">${c.icon}</span>${c.name.split(' ')[0]}
        </button>`).join('')}
      </div>
      <div class="review-skip" onclick="toggleSkip(${i})">Skip this transaction</div>
    </div>`;
  }).join('');
}

function setReviewCat(i, catId) { reviewItems[i].category_id = catId; renderReview(); }
function toggleSkip(i) { reviewItems[i].skip = !reviewItems[i].skip; renderReview(); }

function cancelImport() {
  reviewItems = [];
  document.getElementById('drop-zone-wrap').style.display = 'block';
  document.getElementById('review-wrap').style.display = 'none';
  document.getElementById('pdf-file').value = '';
}

async function saveImport() {
  const toSave = reviewItems.filter(r => !r.skip);
  if (!toSave.length) { alert('No transactions to save'); return; }
  const btn = document.getElementById('save-import-btn');
  btn.textContent = 'Saving…'; btn.disabled = true;
  showSync('syncing', `Saving ${toSave.length} transactions…`);
  try {
    const rows = toSave.map(r => ({ amount: r.amount, merchant: r.merchant, category_id: r.category_id, date: r.date }));
    const saved = await sbInsert('transactions', rows);
    transactions.unshift(...(saved || []));
    cancelImport();
    renderHome(); renderTransactions();
    showSync('ok', `${toSave.length} transactions saved`);
    showPage('tx');
  } catch (e) {
    console.error(e);
    showSync('err', 'Import failed: ' + e.message.slice(0, 60));
  }
  btn.textContent = 'Save all'; btn.disabled = false;
}
