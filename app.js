/* =====================================================
   TGP Ultimate Dashboard — App logic
   ===================================================== */

// ------------ Data Store (localStorage) ----------------
const STORAGE_KEY = 'tgp_dashboard_data_v1';

const defaultData = {
  sales: [],        // {id, date, channel, product, units, revenue, notes}
  tiktok: [],       // {id, date, product, inventory, sales, fulfilled, cancelled, returns, claims, refunded, replaced, notes}
  shopify: [],      // same shape as tiktok
  marketing: [],    // {id, date, type, channel, campaign, spend, revenue, notes}
  inventory: [],    // {id, product, sku, stock, reorder, tiktok, shopify, other, remarks}
  customer: [],     // {id, date, channel, sentiment, rating, category, customer, comment, status, remarks}
  settings: { theme: 'dark' }
};

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedSampleData();
    const parsed = JSON.parse(raw);
    return { ...defaultData, ...parsed };
  } catch {
    return seedSampleData();
  }
}
function saveData() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function seedSampleData() {
  // A small sample so the dashboard isn't empty on first load.
  const today = new Date();
  const day = (n) => {
    const d = new Date(today); d.setDate(d.getDate() - n);
    return d.toISOString().slice(0,10);
  };
  const data = JSON.parse(JSON.stringify(defaultData));
  data.sales = [
    { id: uid(), date: day(0), channel: 'TikTok', product: 'Sleep Gummies', units: 24, revenue: 12000, notes: '' },
    { id: uid(), date: day(0), channel: 'Shopify', product: 'Energy Gummies', units: 12, revenue: 7200, notes: '' },
    { id: uid(), date: day(1), channel: 'TikTok', product: 'Immune Gummies', units: 18, revenue: 9000, notes: '' },
    { id: uid(), date: day(2), channel: 'Shopify', product: 'Sleep Gummies', units: 9, revenue: 4500, notes: '' },
    { id: uid(), date: day(3), channel: 'TikTok', product: 'Sleep Gummies', units: 30, revenue: 15000, notes: 'Live promo' },
    { id: uid(), date: day(5), channel: 'Other', product: 'Energy Gummies', units: 6, revenue: 3600, notes: '' },
  ];
  data.tiktok = [
    { id: uid(), date: day(0), product: 'Sleep Gummies', inventory: 240, sales: 24, fulfilled: 22, cancelled: 1, returns: 1, claims: 0, refunded: 1, replaced: 0, notes: '' },
    { id: uid(), date: day(1), product: 'Immune Gummies', inventory: 180, sales: 18, fulfilled: 17, cancelled: 1, returns: 0, claims: 0, refunded: 0, replaced: 0, notes: '' },
    { id: uid(), date: day(3), product: 'Sleep Gummies', inventory: 210, sales: 30, fulfilled: 29, cancelled: 0, returns: 1, claims: 1, refunded: 1, replaced: 0, notes: 'Damage on transit' },
  ];
  data.shopify = [
    { id: uid(), date: day(0), product: 'Energy Gummies', inventory: 150, sales: 12, fulfilled: 12, cancelled: 0, returns: 0, claims: 0, refunded: 0, replaced: 0, notes: '' },
    { id: uid(), date: day(2), product: 'Sleep Gummies', inventory: 130, sales: 9, fulfilled: 8, cancelled: 1, returns: 0, claims: 0, refunded: 1, replaced: 0, notes: '' },
  ];
  data.marketing = [
    { id: uid(), date: day(0), type: 'Ads', channel: 'TikTok', campaign: 'Sleep Gummies Launch', spend: 2500, revenue: 12000, notes: '' },
    { id: uid(), date: day(1), type: 'Ads', channel: 'Meta', campaign: 'Immune Boost', spend: 1800, revenue: 7400, notes: '' },
    { id: uid(), date: day(2), type: 'Coupon', channel: 'Shopify', campaign: 'WELCOME10', spend: 0, revenue: 4500, notes: 'Discount 10%' },
    { id: uid(), date: day(3), type: 'Affiliate', channel: 'TikTok', campaign: '@gummyfan', spend: 600, revenue: 3000, notes: '' },
  ];
  data.inventory = [
    { id: uid(), product: 'Sleep Gummies', sku: 'TGP-SLP-01', stock: 60, reorder: 80, tiktok: true, shopify: true, other: false, remarks: 'Bestseller' },
    { id: uid(), product: 'Energy Gummies', sku: 'TGP-ENR-02', stock: 140, reorder: 60, tiktok: true, shopify: true, other: true, remarks: '' },
    { id: uid(), product: 'Immune Gummies', sku: 'TGP-IMM-03', stock: 25, reorder: 50, tiktok: true, shopify: false, other: false, remarks: 'Push to Shopify' },
    { id: uid(), product: 'Beauty Gummies', sku: 'TGP-BTY-04', stock: 280, reorder: 80, tiktok: false, shopify: true, other: true, remarks: 'Slow mover' },
  ];
  data.customer = [
    { id: uid(), date: day(0), channel: 'TikTok', sentiment: 'Positive', rating: 5, category: 'Product', customer: 'Maria R.', comment: 'Loved the taste, helped me sleep!', status: 'Resolved', remarks: '' },
    { id: uid(), date: day(1), channel: 'Shopify', sentiment: 'Negative', rating: 2, category: 'Delivery', customer: 'John D.', comment: 'Shipment arrived 5 days late.', status: 'Open', remarks: 'Coordinate w/ courier' },
    { id: uid(), date: day(2), channel: 'TikTok', sentiment: 'Negative', rating: 1, category: 'Customer Service', customer: 'Anna L.', comment: 'No reply from support.', status: 'In Progress', remarks: 'Escalated to CS lead' },
    { id: uid(), date: day(3), channel: 'Shopify', sentiment: 'Positive', rating: 5, category: 'Product', customer: 'Carl M.', comment: 'Great quality!', status: 'Resolved', remarks: '' },
  ];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  return data;
}

function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }

// ------------ State ----------------
let state = loadData();
let dateRange = { from: null, to: null, grain: 'day' };
const charts = {};

// ------------ Utilities ----------------
const peso = (n) => '₱' + (Number(n) || 0).toLocaleString('en-PH', { maximumFractionDigits: 0 });
const num = (n) => Number(n || 0).toLocaleString('en-PH');
const pct = (n) => (Math.round((Number(n) || 0) * 10) / 10) + '%';

function inRange(dateStr) {
  if (!dateStr) return true;
  const d = new Date(dateStr);
  if (dateRange.from && d < new Date(dateRange.from)) return false;
  if (dateRange.to) {
    const end = new Date(dateRange.to); end.setHours(23,59,59,999);
    if (d > end) return false;
  }
  return true;
}

function bucketKey(dateStr, grain = dateRange.grain) {
  const d = new Date(dateStr);
  if (grain === 'week') {
    const onejan = new Date(d.getFullYear(),0,1);
    const week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay()+1)/7);
    return `${d.getFullYear()}-W${String(week).padStart(2,'0')}`;
  }
  if (grain === 'month') return d.toISOString().slice(0,7);
  return d.toISOString().slice(0,10);
}

function groupByBucket(rows, getValue, dateField = 'date') {
  const map = new Map();
  rows.forEach(r => {
    const k = bucketKey(r[dateField]);
    map.set(k, (map.get(k) || 0) + Number(getValue(r) || 0));
  });
  return Array.from(map.entries()).sort((a,b) => a[0].localeCompare(b[0]));
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), 2200);
}

// ------------ Navigation ----------------
const titles = {
  executive: 'Executive Summary',
  sales: 'Sales Performance',
  tiktok: 'TikTok Shop',
  shopify: 'Shopify',
  marketing: 'Marketing Performance',
  inventory: 'Inventory',
  customer: 'Customer Experience'
};

function setView(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.getElementById(`view-${view}`).classList.remove('hidden');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === view));
  document.getElementById('viewTitle').textContent = titles[view];
  document.getElementById('sidebar').classList.remove('open');
  renderAll();
}

document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => setView(btn.dataset.view));
});

document.getElementById('menuToggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

// ------------ Date range ----------------
document.getElementById('applyRange').addEventListener('click', () => {
  dateRange.from = document.getElementById('dateFrom').value || null;
  dateRange.to = document.getElementById('dateTo').value || null;
  dateRange.grain = document.getElementById('grain').value;
  renderAll();
});
document.getElementById('resetRange').addEventListener('click', () => {
  document.getElementById('dateFrom').value = '';
  document.getElementById('dateTo').value = '';
  document.getElementById('grain').value = 'day';
  dateRange = { from: null, to: null, grain: 'day' };
  renderAll();
});

// ------------ Theme ----------------
function applyTheme() {
  if (state.settings.theme === 'light') document.body.setAttribute('data-theme', 'light');
  else document.body.removeAttribute('data-theme');
}
document.getElementById('themeBtn').addEventListener('click', () => {
  state.settings.theme = state.settings.theme === 'light' ? 'dark' : 'light';
  saveData();
  applyTheme();
  renderAll();
});
applyTheme();

// ------------ Export / Import ----------------
document.getElementById('exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `tgp-dashboard-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Data exported');
});
document.getElementById('importBtn').addEventListener('click', () => {
  document.getElementById('importFile').click();
});
document.getElementById('importFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const obj = JSON.parse(ev.target.result);
      state = { ...defaultData, ...obj };
      saveData();
      renderAll();
      showToast('Data imported');
    } catch { showToast('Import failed'); }
  };
  reader.readAsText(file);
});

// ------------ Modal / Forms ----------------
const modal = document.getElementById('modal');
const modalForm = document.getElementById('modalForm');
const modalTitle = document.getElementById('modalTitle');
let editing = null; // { type, id }

const formSchemas = {
  sales: {
    title: 'Sale Entry',
    fields: [
      { name: 'date', label: 'Date', type: 'date', required: true },
      { name: 'channel', label: 'Channel', type: 'select', options: ['TikTok','Shopify','Other'], required: true },
      { name: 'product', label: 'Product', type: 'text', required: true },
      { name: 'units', label: 'Units Sold', type: 'number', step: 1 },
      { name: 'revenue', label: 'Revenue (₱)', type: 'number', step: 0.01 },
      { name: 'notes', label: 'Notes / Remarks', type: 'textarea', full: true }
    ]
  },
  tiktok: {
    title: 'TikTok Shop Entry',
    fields: [
      { name: 'date', label: 'Date', type: 'date', required: true },
      { name: 'product', label: 'Product', type: 'text', required: true },
      { name: 'inventory', label: 'Inventory', type: 'number' },
      { name: 'sales', label: 'Sales (units)', type: 'number' },
      { name: 'fulfilled', label: 'Fulfilled', type: 'number' },
      { name: 'cancelled', label: 'Cancellations', type: 'number' },
      { name: 'returns', label: 'Returns', type: 'number' },
      { name: 'claims', label: 'Claims Filed', type: 'number' },
      { name: 'refunded', label: 'Refunded', type: 'number' },
      { name: 'replaced', label: 'Replacements', type: 'number' },
      { name: 'notes', label: 'Notes / Remarks', type: 'textarea', full: true }
    ]
  },
  shopify: {
    title: 'Shopify Entry',
    fields: [
      { name: 'date', label: 'Date', type: 'date', required: true },
      { name: 'product', label: 'Product', type: 'text', required: true },
      { name: 'inventory', label: 'Inventory', type: 'number' },
      { name: 'sales', label: 'Sales (units)', type: 'number' },
      { name: 'fulfilled', label: 'Fulfilled', type: 'number' },
      { name: 'cancelled', label: 'Cancellations', type: 'number' },
      { name: 'returns', label: 'Returns', type: 'number' },
      { name: 'claims', label: 'Claims Filed', type: 'number' },
      { name: 'refunded', label: 'Refunded', type: 'number' },
      { name: 'replaced', label: 'Replacements', type: 'number' },
      { name: 'notes', label: 'Notes / Remarks', type: 'textarea', full: true }
    ]
  },
  marketing: {
    title: 'Marketing Entry',
    fields: [
      { name: 'date', label: 'Date', type: 'date', required: true },
      { name: 'type', label: 'Type', type: 'select', options: ['Coupon','Discount','Ads','Affiliate'], required: true },
      { name: 'channel', label: 'Channel', type: 'select', options: ['TikTok','Shopify','Meta','Google','Other'] },
      { name: 'campaign', label: 'Campaign / Code', type: 'text' },
      { name: 'spend', label: 'Spend (₱)', type: 'number', step: 0.01 },
      { name: 'revenue', label: 'Attributed Revenue (₱)', type: 'number', step: 0.01 },
      { name: 'notes', label: 'Notes', type: 'textarea', full: true }
    ]
  },
  inventory: {
    title: 'Product / Inventory',
    fields: [
      { name: 'product', label: 'Product Name', type: 'text', required: true },
      { name: 'sku', label: 'SKU', type: 'text' },
      { name: 'stock', label: 'Current Stock', type: 'number' },
      { name: 'reorder', label: 'Reorder Threshold', type: 'number' },
      { name: 'tiktok', label: 'Live on TikTok', type: 'checkbox' },
      { name: 'shopify', label: 'Live on Shopify', type: 'checkbox' },
      { name: 'other', label: 'Live on Other Store', type: 'checkbox' },
      { name: 'remarks', label: 'Remarks / Comments', type: 'textarea', full: true }
    ]
  },
  customer: {
    title: 'Customer Review / Complaint',
    fields: [
      { name: 'date', label: 'Date', type: 'date', required: true },
      { name: 'channel', label: 'Channel', type: 'select', options: ['TikTok','Shopify','Other'] },
      { name: 'sentiment', label: 'Sentiment', type: 'select', options: ['Positive','Neutral','Negative'], required: true },
      { name: 'rating', label: 'Rating (1-5)', type: 'number', step: 1 },
      { name: 'category', label: 'Category', type: 'select', options: ['Product','Customer Service','Shop','Delivery','Other'] },
      { name: 'customer', label: 'Customer Name', type: 'text' },
      { name: 'comment', label: 'Comment / Review', type: 'textarea', full: true },
      { name: 'status', label: 'Status', type: 'select', options: ['Open','In Progress','Resolved','Closed'] },
      { name: 'remarks', label: 'Internal Remarks', type: 'textarea', full: true }
    ]
  }
};

function openModal(type, id = null) {
  const schema = formSchemas[type];
  editing = { type, id };
  modalTitle.textContent = (id ? 'Edit ' : 'Add ') + schema.title;
  const existing = id ? state[type].find(r => r.id === id) : {};
  modalForm.innerHTML = schema.fields.map(f => {
    const val = existing[f.name] ?? (f.type === 'checkbox' ? false : '');
    const wrapClass = f.full ? 'full' : '';
    if (f.type === 'select') {
      return `<label class="${wrapClass}">${f.label}
        <select name="${f.name}" ${f.required?'required':''}>
          <option value="">— Select —</option>
          ${f.options.map(o => `<option value="${o}" ${val===o?'selected':''}>${o}</option>`).join('')}
        </select></label>`;
    }
    if (f.type === 'textarea') {
      return `<label class="${wrapClass}">${f.label}
        <textarea name="${f.name}">${val ?? ''}</textarea></label>`;
    }
    if (f.type === 'checkbox') {
      return `<label class="${wrapClass}" style="flex-direction:row;align-items:center;gap:10px;">
        <input type="checkbox" name="${f.name}" ${val?'checked':''} style="width:auto;" />
        <span>${f.label}</span></label>`;
    }
    const step = f.step ? `step="${f.step}"` : '';
    return `<label class="${wrapClass}">${f.label}
      <input type="${f.type}" name="${f.name}" value="${val ?? ''}" ${step} ${f.required?'required':''} /></label>`;
  }).join('');
  modal.classList.remove('hidden');
}

function closeModal() {
  modal.classList.add('hidden');
  editing = null;
  modalForm.innerHTML = '';
}

document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('modalCancel').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

document.getElementById('modalSave').addEventListener('click', () => {
  if (!editing) return;
  const { type, id } = editing;
  const schema = formSchemas[type];
  const formData = new FormData(modalForm);
  const record = id ? state[type].find(r => r.id === id) : { id: uid() };
  schema.fields.forEach(f => {
    if (f.type === 'checkbox') record[f.name] = modalForm.querySelector(`[name="${f.name}"]`).checked;
    else if (f.type === 'number') record[f.name] = formData.get(f.name) === '' ? 0 : Number(formData.get(f.name));
    else record[f.name] = formData.get(f.name) || '';
  });
  // Required validation
  for (const f of schema.fields) {
    if (f.required && !record[f.name] && record[f.name] !== 0) {
      showToast(`${f.label} is required`);
      return;
    }
  }
  if (!id) state[type].push(record);
  saveData();
  closeModal();
  renderAll();
  showToast(id ? 'Entry updated' : 'Entry added');
});

// Add / Edit / Delete row buttons
document.addEventListener('click', (e) => {
  const addBtn = e.target.closest('[data-add]');
  if (addBtn) { openModal(addBtn.dataset.add); return; }
  const editBtn = e.target.closest('[data-edit]');
  if (editBtn) { openModal(editBtn.dataset.edit, editBtn.dataset.id); return; }
  const delBtn = e.target.closest('[data-del]');
  if (delBtn) {
    const type = delBtn.dataset.del;
    const id = delBtn.dataset.id;
    if (confirm('Delete this entry?')) {
      state[type] = state[type].filter(r => r.id !== id);
      saveData();
      renderAll();
      showToast('Entry deleted');
    }
  }
});

// Filters
['salesChannelFilter','marketingTypeFilter','inventoryStockFilter','inventorySearch','cxSentimentFilter','cxCategoryFilter']
  .forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', renderAll);
  });

// ------------ Computations ----------------
function filteredSales() { return state.sales.filter(r => inRange(r.date)); }
function filteredTikTok() { return state.tiktok.filter(r => inRange(r.date)); }
function filteredShopify() { return state.shopify.filter(r => inRange(r.date)); }
function filteredMarketing() { return state.marketing.filter(r => inRange(r.date)); }
function filteredCustomer() { return state.customer.filter(r => inRange(r.date)); }

function execMetrics() {
  const sales = filteredSales();
  const tt = filteredTikTok();
  const sp = filteredShopify();
  const mk = filteredMarketing();
  const totalRevenue = sales.reduce((a,b) => a + Number(b.revenue||0), 0);
  const orders = sales.reduce((a,b) => a + Number(b.units||0), 0);
  const cancellations = tt.reduce((a,b)=>a+Number(b.cancelled||0),0) + sp.reduce((a,b)=>a+Number(b.cancelled||0),0);
  const returnsR = tt.reduce((a,b)=>a+Number(b.returns||0)+Number(b.refunded||0),0)
                 + sp.reduce((a,b)=>a+Number(b.returns||0)+Number(b.refunded||0),0);
  const fulfilled = tt.reduce((a,b)=>a+Number(b.fulfilled||0),0) + sp.reduce((a,b)=>a+Number(b.fulfilled||0),0);
  const adSpend = mk.reduce((a,b)=>a+Number(b.spend||0),0);
  const adRevenue = mk.reduce((a,b)=>a+Number(b.revenue||0),0);
  const roas = adSpend > 0 ? (adRevenue / adSpend) : 0;
  return {
    totalRevenue, orders,
    aov: orders > 0 ? totalRevenue / orders : 0,
    cancellations, cancelRate: (cancellations + fulfilled) > 0 ? (cancellations/(cancellations+fulfilled))*100 : 0,
    returnsR, returnsRate: fulfilled > 0 ? (returnsR/fulfilled)*100 : 0,
    adSpend, roas
  };
}

// ------------ Render: Executive ----------------
function renderExecutive() {
  const m = execMetrics();
  document.getElementById('kpiRevenue').textContent = peso(m.totalRevenue);
  document.getElementById('kpiOrders').textContent = num(m.orders);
  document.getElementById('kpiAOV').textContent = peso(m.aov);
  document.getElementById('kpiCancel').textContent = num(m.cancellations);
  document.getElementById('kpiCancelRate').textContent = pct(m.cancelRate) + ' rate';
  document.getElementById('kpiReturns').textContent = num(m.returnsR);
  document.getElementById('kpiReturnsRate').textContent = pct(m.returnsRate) + ' rate';
  document.getElementById('kpiROAS').textContent = (Math.round(m.roas*10)/10) + '×';
  document.getElementById('kpiAdSpend').textContent = peso(m.adSpend) + ' spent';

  // Revenue trend chart by channel
  const sales = filteredSales();
  const channels = ['TikTok','Shopify','Other'];
  const buckets = new Set();
  sales.forEach(r => buckets.add(bucketKey(r.date)));
  const labels = Array.from(buckets).sort();
  const datasets = channels.map((ch, i) => ({
    label: ch,
    data: labels.map(lbl => sales.filter(r => bucketKey(r.date)===lbl && r.channel===ch).reduce((a,b)=>a+Number(b.revenue||0),0)),
    borderColor: ['#7c5cff','#22d3ee','#34d399'][i],
    backgroundColor: ['rgba(124,92,255,0.18)','rgba(34,211,238,0.18)','rgba(52,211,153,0.18)'][i],
    fill: true, tension: 0.35, borderWidth: 2, pointRadius: 3
  }));
  drawChart('execRevenueChart', 'line', { labels, datasets });

  // Channel mix doughnut
  const mix = channels.map(ch => sales.filter(r=>r.channel===ch).reduce((a,b)=>a+Number(b.revenue||0),0));
  drawChart('execMixChart', 'doughnut', {
    labels: channels,
    datasets: [{ data: mix, backgroundColor: ['#7c5cff','#22d3ee','#34d399'], borderWidth: 0 }]
  });

  // Top products
  const totals = new Map();
  sales.forEach(r => {
    const k = `${r.product}||${r.channel}`;
    const t = totals.get(k) || { product: r.product, channel: r.channel, units: 0, revenue: 0 };
    t.units += Number(r.units||0); t.revenue += Number(r.revenue||0);
    totals.set(k, t);
  });
  const top = Array.from(totals.values()).sort((a,b)=>b.revenue-a.revenue).slice(0,6);
  const topBody = document.querySelector('#topProductsTable tbody');
  topBody.innerHTML = top.length ? top.map(t => `
    <tr><td>${t.product}</td><td><span class="pill ${t.channel==='TikTok'?'purple':t.channel==='Shopify'?'blue':'gray'}">${t.channel}</span></td><td>${num(t.units)}</td><td>${peso(t.revenue)}</td></tr>
  `).join('') : `<tr><td colspan="4" class="empty">No sales in range</td></tr>`;

  // Activity feed
  const activity = [
    ...sales.slice(-5).map(r => ({ when: r.date, text: `Sale logged: ${r.product} on ${r.channel} — ${peso(r.revenue)}` })),
    ...filteredCustomer().slice(-3).map(r => ({ when: r.date, text: `${r.sentiment} review (${r.category}) from ${r.customer || 'customer'}` })),
    ...filteredMarketing().slice(-3).map(r => ({ when: r.date, text: `${r.type} — ${r.campaign || ''} on ${r.channel || ''}` }))
  ].sort((a,b) => (b.when||'').localeCompare(a.when||'')).slice(0,8);
  document.getElementById('activityList').innerHTML = activity.length ? activity.map(a => `
    <li><span class="dot"></span><span>${a.text}</span><span class="a-meta">${a.when || ''}</span></li>
  `).join('') : `<li class="empty">No recent activity</li>`;
}

// ------------ Render: Sales ----------------
function renderSales() {
  const channelFilter = document.getElementById('salesChannelFilter').value;
  const rows = filteredSales().filter(r => !channelFilter || r.channel === channelFilter)
    .sort((a,b) => (b.date||'').localeCompare(a.date||''));
  const body = document.querySelector('#salesTable tbody');
  body.innerHTML = rows.length ? rows.map(r => `
    <tr>
      <td>${r.date}</td>
      <td><span class="pill ${r.channel==='TikTok'?'purple':r.channel==='Shopify'?'blue':'gray'}">${r.channel}</span></td>
      <td>${r.product}</td>
      <td>${num(r.units)}</td>
      <td>${peso(r.revenue)}</td>
      <td>${r.notes || ''}</td>
      <td><div class="row-actions">
        <button data-edit="sales" data-id="${r.id}">Edit</button>
        <button class="danger" data-del="sales" data-id="${r.id}">Delete</button>
      </div></td>
    </tr>
  `).join('') : `<tr><td colspan="7" class="empty">No sales in range. Click "+ Add Sale Entry".</td></tr>`;

  // Trend chart
  const trend = groupByBucket(filteredSales(), r => r.revenue);
  drawChart('salesTrendChart', 'line', {
    labels: trend.map(t=>t[0]),
    datasets: [{ label: 'Revenue', data: trend.map(t=>t[1]), borderColor: '#7c5cff', backgroundColor: 'rgba(124,92,255,0.18)', fill:true, tension:0.35, borderWidth:2 }]
  });

  // Channel comparison
  const chans = ['TikTok','Shopify','Other'];
  drawChart('salesChannelChart', 'bar', {
    labels: chans,
    datasets: [{
      label: 'Revenue',
      data: chans.map(c => filteredSales().filter(r=>r.channel===c).reduce((a,b)=>a+Number(b.revenue||0),0)),
      backgroundColor: ['#7c5cff','#22d3ee','#34d399'], borderRadius: 8
    }]
  });
}

// ------------ Render: TikTok / Shopify (shared) ----------------
function renderChannel(type, prefix) {
  const data = type === 'tiktok' ? filteredTikTok() : filteredShopify();
  const sales = filteredSales().filter(r => r.channel === (type==='tiktok'?'TikTok':'Shopify'));
  document.getElementById(`${prefix}Revenue`).textContent = peso(sales.reduce((a,b)=>a+Number(b.revenue||0),0));
  document.getElementById(`${prefix}Fulfilled`).textContent = num(data.reduce((a,b)=>a+Number(b.fulfilled||0),0));
  document.getElementById(`${prefix}Cancel`).textContent = num(data.reduce((a,b)=>a+Number(b.cancelled||0),0));
  document.getElementById(`${prefix}Returns`).textContent = num(data.reduce((a,b)=>a+Number(b.returns||0)+Number(b.refunded||0),0));

  const rows = data.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const body = document.querySelector(`#${type}Table tbody`);
  body.innerHTML = rows.length ? rows.map(r => `
    <tr>
      <td>${r.date}</td><td>${r.product}</td>
      <td>${num(r.inventory)}</td><td>${num(r.sales)}</td><td>${num(r.fulfilled)}</td>
      <td>${num(r.cancelled)}</td><td>${num(r.returns)}</td><td>${num(r.claims)}</td>
      <td>${num(r.refunded)}</td><td>${num(r.replaced)}</td>
      <td>${r.notes || ''}</td>
      <td><div class="row-actions">
        <button data-edit="${type}" data-id="${r.id}">Edit</button>
        <button class="danger" data-del="${type}" data-id="${r.id}">Delete</button>
      </div></td>
    </tr>
  `).join('') : `<tr><td colspan="12" class="empty">No entries yet.</td></tr>`;

  const labels = Array.from(new Set(data.map(r => bucketKey(r.date)))).sort();
  const series = (key) => labels.map(l => data.filter(r => bucketKey(r.date)===l).reduce((a,b)=>a+Number(b[key]||0),0));
  drawChart(`${type}TrendChart`, 'line', {
    labels,
    datasets: [
      { label: 'Sales', data: series('sales'), borderColor: '#7c5cff', backgroundColor:'rgba(124,92,255,0.15)', tension:0.35, fill:true, borderWidth:2 },
      { label: 'Fulfilled', data: series('fulfilled'), borderColor: '#34d399', backgroundColor:'rgba(52,211,153,0.12)', tension:0.35, fill:true, borderWidth:2 },
      { label: 'Cancelled', data: series('cancelled'), borderColor: '#fbbf24', backgroundColor:'rgba(251,191,36,0.12)', tension:0.35, fill:false, borderWidth:2 },
      { label: 'Returns', data: series('returns'), borderColor: '#f87171', backgroundColor:'rgba(248,113,113,0.12)', tension:0.35, fill:false, borderWidth:2 }
    ]
  });
}

// ------------ Render: Marketing ----------------
function renderMarketing() {
  const typeFilter = document.getElementById('marketingTypeFilter').value;
  const data = filteredMarketing().filter(r => !typeFilter || r.type === typeFilter);
  const totalSpend = data.reduce((a,b)=>a+Number(b.spend||0),0);
  const totalRev = data.reduce((a,b)=>a+Number(b.revenue||0),0);
  const discountRows = data.filter(r => r.type === 'Coupon' || r.type === 'Discount');
  document.getElementById('mkSpend').textContent = peso(totalSpend);
  document.getElementById('mkRevenue').textContent = peso(totalRev);
  document.getElementById('mkROAS').textContent = (totalSpend>0 ? (totalRev/totalSpend) : 0).toFixed(1) + '×';
  document.getElementById('mkDiscounts').textContent = peso(discountRows.reduce((a,b)=>a+Number(b.revenue||0),0));

  const body = document.querySelector('#marketingTable tbody');
  const rows = data.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  body.innerHTML = rows.length ? rows.map(r => {
    const roas = Number(r.spend) > 0 ? (Number(r.revenue||0)/Number(r.spend)).toFixed(1) + '×' : '—';
    const tCol = { Coupon:'green', Discount:'yellow', Ads:'purple', Affiliate:'blue' }[r.type] || 'gray';
    return `<tr>
      <td>${r.date}</td>
      <td><span class="pill ${tCol}">${r.type}</span></td>
      <td>${r.channel || ''}</td>
      <td>${r.campaign || ''}</td>
      <td>${peso(r.spend)}</td>
      <td>${peso(r.revenue)}</td>
      <td>${roas}</td>
      <td>${r.notes || ''}</td>
      <td><div class="row-actions">
        <button data-edit="marketing" data-id="${r.id}">Edit</button>
        <button class="danger" data-del="marketing" data-id="${r.id}">Delete</button>
      </div></td>
    </tr>`;
  }).join('') : `<tr><td colspan="9" class="empty">No marketing entries in range.</td></tr>`;

  const labels = Array.from(new Set(data.map(r => bucketKey(r.date)))).sort();
  drawChart('mkSpendChart', 'bar', {
    labels,
    datasets: [
      { label: 'Spend', data: labels.map(l => data.filter(r => bucketKey(r.date)===l).reduce((a,b)=>a+Number(b.spend||0),0)), backgroundColor: '#7c5cff', borderRadius: 6 },
      { label: 'Revenue', data: labels.map(l => data.filter(r => bucketKey(r.date)===l).reduce((a,b)=>a+Number(b.revenue||0),0)), backgroundColor: '#22d3ee', borderRadius: 6 }
    ]
  });

  const types = ['Coupon','Discount','Ads','Affiliate'];
  drawChart('mkTypeChart', 'doughnut', {
    labels: types,
    datasets: [{ data: types.map(t => data.filter(r=>r.type===t).reduce((a,b)=>a+Number(b.spend||0),0)),
      backgroundColor: ['#34d399','#fbbf24','#7c5cff','#22d3ee'], borderWidth: 0 }]
  });
}

// ------------ Render: Inventory ----------------
function stockLevel(stock, reorder) {
  stock = Number(stock||0); reorder = Number(reorder||0);
  if (stock <= 0) return { label: 'Critical', cls: 'red', remark: 'Out of stock — replenish now' };
  if (stock < reorder * 0.5) return { label: 'Critical', cls: 'red', remark: 'Replenish urgently' };
  if (stock < reorder) return { label: 'Low', cls: 'yellow', remark: 'Reorder recommended' };
  if (stock > reorder * 4) return { label: 'Overstock', cls: 'blue', remark: 'Consider promotions' };
  return { label: 'Healthy', cls: 'green', remark: 'OK' };
}

function renderInventory() {
  const stockFilter = document.getElementById('inventoryStockFilter').value;
  const search = (document.getElementById('inventorySearch').value || '').toLowerCase();
  const rows = state.inventory
    .map(r => ({ ...r, _level: stockLevel(r.stock, r.reorder) }))
    .filter(r => !stockFilter || r._level.label === stockFilter)
    .filter(r => !search || (r.product+' '+r.sku).toLowerCase().includes(search));
  const body = document.querySelector('#inventoryTable tbody');
  body.innerHTML = rows.length ? rows.map(r => `
    <tr>
      <td><strong>${r.product}</strong></td>
      <td>${r.sku || ''}</td>
      <td>${num(r.stock)}</td>
      <td><span class="pill ${r._level.cls}">${r._level.label}</span></td>
      <td>${r.tiktok ? '<span class="pill purple">Live</span>' : '<span class="pill gray">—</span>'}</td>
      <td>${r.shopify ? '<span class="pill blue">Live</span>' : '<span class="pill gray">—</span>'}</td>
      <td>${r.other ? '<span class="pill green">Live</span>' : '<span class="pill gray">—</span>'}</td>
      <td>${num(r.reorder)}</td>
      <td>${r.remarks || r._level.remark}</td>
      <td><div class="row-actions">
        <button data-edit="inventory" data-id="${r.id}">Edit</button>
        <button class="danger" data-del="inventory" data-id="${r.id}">Delete</button>
      </div></td>
    </tr>
  `).join('') : `<tr><td colspan="10" class="empty">No products. Click "+ Add Product".</td></tr>`;

  const levels = ['Critical','Low','Healthy','Overstock'];
  drawChart('invHealthChart', 'doughnut', {
    labels: levels,
    datasets: [{ data: levels.map(l => state.inventory.filter(p => stockLevel(p.stock,p.reorder).label===l).length),
      backgroundColor: ['#f87171','#fbbf24','#34d399','#22d3ee'], borderWidth: 0 }]
  });

  drawChart('invCoverageChart', 'bar', {
    labels: ['TikTok','Shopify','Other'],
    datasets: [{ label: 'Products Listed', data: [
      state.inventory.filter(p=>p.tiktok).length,
      state.inventory.filter(p=>p.shopify).length,
      state.inventory.filter(p=>p.other).length,
    ], backgroundColor: ['#7c5cff','#22d3ee','#34d399'], borderRadius: 8 }]
  });
}

// ------------ Render: Customer ----------------
function renderCustomer() {
  const data = filteredCustomer();
  const sentFilter = document.getElementById('cxSentimentFilter').value;
  const catFilter = document.getElementById('cxCategoryFilter').value;
  const rows = data.filter(r => !sentFilter || r.sentiment === sentFilter)
                   .filter(r => !catFilter || r.category === catFilter)
                   .sort((a,b)=>(b.date||'').localeCompare(a.date||''));

  document.getElementById('cxPositive').textContent = num(data.filter(r=>r.sentiment==='Positive').length);
  document.getElementById('cxNegative').textContent = num(data.filter(r=>r.sentiment==='Negative').length);
  const ratings = data.map(r=>Number(r.rating||0)).filter(n=>n>0);
  const avg = ratings.length ? (ratings.reduce((a,b)=>a+b,0)/ratings.length) : 0;
  document.getElementById('cxRating').textContent = avg.toFixed(1);
  const resolved = data.filter(r => r.status === 'Resolved' || r.status === 'Closed').length;
  document.getElementById('cxResolution').textContent = data.length ? Math.round((resolved/data.length)*100) + '%' : '0%';

  const body = document.querySelector('#customerTable tbody');
  body.innerHTML = rows.length ? rows.map(r => {
    const sCol = r.sentiment==='Positive'?'green':r.sentiment==='Negative'?'red':'gray';
    const stCol = r.status==='Resolved'||r.status==='Closed'?'green':r.status==='In Progress'?'yellow':'red';
    return `<tr>
      <td>${r.date}</td><td>${r.channel || ''}</td>
      <td><span class="pill ${sCol}">${r.sentiment}</span></td>
      <td>${r.rating ? '★'.repeat(Number(r.rating)) : ''}</td>
      <td>${r.category || ''}</td>
      <td>${r.customer || ''}</td>
      <td>${r.comment || ''}</td>
      <td><span class="pill ${stCol}">${r.status || 'Open'}</span></td>
      <td>${r.remarks || ''}</td>
      <td><div class="row-actions">
        <button data-edit="customer" data-id="${r.id}">Edit</button>
        <button class="danger" data-del="customer" data-id="${r.id}">Delete</button>
      </div></td>
    </tr>`;
  }).join('') : `<tr><td colspan="10" class="empty">No reviews in range.</td></tr>`;

  const labels = Array.from(new Set(data.map(r => bucketKey(r.date)))).sort();
  drawChart('cxSentimentChart', 'line', {
    labels,
    datasets: [
      { label: 'Positive', data: labels.map(l => data.filter(r=>bucketKey(r.date)===l && r.sentiment==='Positive').length), borderColor: '#34d399', backgroundColor:'rgba(52,211,153,0.18)', tension:0.35, fill:true, borderWidth:2 },
      { label: 'Negative', data: labels.map(l => data.filter(r=>bucketKey(r.date)===l && r.sentiment==='Negative').length), borderColor: '#f87171', backgroundColor:'rgba(248,113,113,0.18)', tension:0.35, fill:true, borderWidth:2 },
      { label: 'Neutral', data: labels.map(l => data.filter(r=>bucketKey(r.date)===l && r.sentiment==='Neutral').length), borderColor: '#8b94b8', backgroundColor:'rgba(139,148,184,0.18)', tension:0.35, fill:true, borderWidth:2 }
    ]
  });

  const cats = ['Product','Customer Service','Shop','Delivery','Other'];
  drawChart('cxCategoryChart', 'bar', {
    labels: cats,
    datasets: [{ label: 'Complaints', data: cats.map(c => data.filter(r=>r.sentiment==='Negative' && r.category===c).length),
      backgroundColor: ['#7c5cff','#22d3ee','#fbbf24','#f87171','#8b94b8'], borderRadius: 8 }]
  });
}

// ------------ Chart helper ----------------
function chartTextColor() {
  return getComputedStyle(document.body).getPropertyValue('--text').trim() || '#e8ecf8';
}
function chartGrid() {
  return state.settings.theme === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';
}
function drawChart(canvasId, type, data) {
  const el = document.getElementById(canvasId);
  if (!el) return;
  if (charts[canvasId]) charts[canvasId].destroy();
  const opts = {
    responsive: true,
    plugins: {
      legend: { labels: { color: chartTextColor(), font: { family: 'Inter', size: 11.5 } } },
      tooltip: { backgroundColor: 'rgba(15,21,43,0.95)', borderColor: 'rgba(124,92,255,0.4)', borderWidth: 1 }
    },
    scales: (type === 'doughnut' || type === 'pie') ? {} : {
      x: { ticks: { color: chartTextColor() }, grid: { color: chartGrid() } },
      y: { ticks: { color: chartTextColor() }, grid: { color: chartGrid() }, beginAtZero: true }
    }
  };
  charts[canvasId] = new Chart(el, { type, data, options: opts });
}

// ------------ Render All ----------------
function renderAll() {
  renderExecutive();
  renderSales();
  renderChannel('tiktok', 'tt');
  renderChannel('shopify', 'sp');
  renderMarketing();
  renderInventory();
  renderCustomer();
}

// ------------ Boot ----------------
renderAll();
