/* TGP Ultimate Dashboard v2 - Firebase + USD + Auto-calc + Profit + Linked tabs */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBGNZZVMifUnvqYei595CXSoIL1RAIuM_8",
  authDomain: "tgp-dashboard.firebaseapp.com",
  projectId: "tgp-dashboard",
  storageBucket: "tgp-dashboard.firebasestorage.app",
  messagingSenderId: "435075480882",
  appId: "1:435075480882:web:7727c84ace1c50f94dab2b"
};

const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);
const DASHBOARD_DOC = doc(db, "dashboards", "main");

const defaultData = {
  sales: [], tiktok: [], shopify: [], marketing: [], inventory: [], customer: [],
  settings: { theme: 'dark' }
};

function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }

let state = JSON.parse(JSON.stringify(defaultData));
let dateRange = { from: null, to: null, grain: 'day' };
const charts = {};
let isReady = false;
let saveTimer = null;

// ============================================================
// MIGRATION: keeps existing data, adds new fields safely
// ============================================================
function migrateData(d) {
  if (!d) return d;
  // Inventory: add cost & price fields if missing
  (d.inventory || []).forEach(p => {
    if (p.cost === undefined) p.cost = 0;
    if (p.price === undefined) p.price = 0;
  });
  // Sales: add units price fields if missing (revenue stays as-is)
  (d.sales || []).forEach(s => {
    if (s.price === undefined) s.price = s.units > 0 ? Number(s.revenue || 0) / Number(s.units) : 0;
    if (s.cost === undefined) s.cost = 0;
  });
  return d;
}

async function initFirebase() {
  try {
    showSyncStatus('Connecting to cloud...');
    const snap = await getDoc(DASHBOARD_DOC);
    if (snap.exists()) {
      state = migrateData({ ...defaultData, ...snap.data() });
    } else {
      state = JSON.parse(JSON.stringify(defaultData));
      await setDoc(DASHBOARD_DOC, state);
    }
    isReady = true;
    applyTheme();
    renderAll();
    showSyncStatus('✓ Synced');
    onSnapshot(DASHBOARD_DOC, (snap) => {
      if (!snap.exists()) return;
      const remote = snap.data();
      if (JSON.stringify(remote) !== JSON.stringify(state)) {
        state = migrateData({ ...defaultData, ...remote });
        renderAll();
        showSyncStatus('✓ Updated from cloud');
      }
    });
  } catch (err) {
    console.error('Firebase error:', err);
    showSyncStatus('⚠ Offline');
    isReady = true;
    applyTheme();
    renderAll();
  }
}

function saveData() {
  if (!isReady) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      showSyncStatus('Saving...');
      await setDoc(DASHBOARD_DOC, state);
      showSyncStatus('✓ Saved');
    } catch (err) { showSyncStatus('⚠ Save failed'); }
  }, 500);
}

function showSyncStatus(msg) {
  let el = document.getElementById('syncStatus');
  if (!el) {
    el = document.createElement('div');
    el.id = 'syncStatus';
    el.style.cssText = 'position:fixed;bottom:14px;right:14px;background:rgba(15,21,43,0.92);color:#e8ecf8;padding:8px 14px;border-radius:8px;font-size:12px;z-index:9999;border:1px solid rgba(124,92,255,0.3);';
    document.body.appendChild(el);
  }
  el.textContent = msg;
}

const usd = (n) => '$' + (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
const usd2 = (n) => '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (n) => Number(n || 0).toLocaleString('en-US');
const pct = (n) => (Math.round((Number(n) || 0) * 10) / 10) + '%';

function inRange(dateStr) {
  if (!dateStr) return true;
  const d = new Date(dateStr);
  if (dateRange.from && d < new Date(dateRange.from)) return false;
  if (dateRange.to) { const end = new Date(dateRange.to); end.setHours(23,59,59,999); if (d > end) return false; }
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
  rows.forEach(r => { const k = bucketKey(r[dateField]); map.set(k, (map.get(k) || 0) + Number(getValue(r) || 0)); });
  return Array.from(map.entries()).sort((a,b) => a[0].localeCompare(b[0]));
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), 2200);
}

const titles = {
  executive: 'Executive Summary',
  sales: 'Sales Performance',
  tiktok: 'TikTok Shop',
  shopify: 'Shopify',
  marketing: 'Marketing Performance',
  inventory: 'Inventory',
  customer: 'Customer Experience',
  profitability: 'Profitability'
};

function setView(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  const target = document.getElementById(`view-${view}`);
  if (target) target.classList.remove('hidden');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === view));
  document.getElementById('viewTitle').textContent = titles[view];
  document.getElementById('sidebar').classList.remove('open');
  renderAll();
}

document.querySelectorAll('.nav-item').forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.view)));
document.getElementById('menuToggle').addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));

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

function applyTheme() {
  if (state.settings && state.settings.theme === 'light') document.body.setAttribute('data-theme', 'light');
  else document.body.removeAttribute('data-theme');
}
document.getElementById('themeBtn').addEventListener('click', () => {
  if (!state.settings) state.settings = {};
  state.settings.theme = state.settings.theme === 'light' ? 'dark' : 'light';
  saveData(); applyTheme(); renderAll();
});

document.getElementById('exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `tgp-dashboard-${new Date().toISOString().slice(0,10)}.json`;
  a.click(); URL.revokeObjectURL(url); showToast('Data exported');
});
document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
document.getElementById('importFile').addEventListener('change', (e) => {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const obj = JSON.parse(ev.target.result);
      if (!confirm('This will REPLACE all current cloud data. Continue?')) return;
      state = migrateData({ ...defaultData, ...obj });
      saveData(); renderAll(); showToast('Data imported');
    } catch { showToast('Import failed'); }
  };
  reader.readAsText(file);
});

const modal = document.getElementById('modal');
const modalForm = document.getElementById('modalForm');
const modalTitle = document.getElementById('modalTitle');
let editing = null;

// Helper: get product list for dropdowns
function productOptions() {
  return state.inventory.map(p => p.product).filter(Boolean);
}

// Helper: find product details by name
function findProduct(name) {
  return state.inventory.find(p => p.product === name);
}

const formSchemas = {
  sales: { title: 'Sale Entry', fields: [
    { name: 'date', label: 'Date', type: 'date', required: true },
    { name: 'channel', label: 'Channel', type: 'select', options: ['TikTok','Shopify','Other'], required: true },
    { name: 'product', label: 'Product', type: 'product-select', required: true },
    { name: 'units', label: 'Units Sold', type: 'number', step: 1 },
    { name: 'price', label: 'Price per Unit ($)', type: 'number', step: 0.01, hint: 'Auto-fills from product. Override for discounts.' },
    { name: 'cost', label: 'Cost per Unit ($)', type: 'number', step: 0.01, hint: 'Auto-fills from product.' },
    { name: 'revenue', label: 'Revenue ($) — auto-calculated', type: 'number', step: 0.01, readonly: true, hint: 'Units × Price. You can override.' },
    { name: 'notes', label: 'Notes / Remarks', type: 'textarea', full: true }
  ]},
  tiktok: { title: 'TikTok Shop Operational Entry', fields: [
    { name: 'date', label: 'Date', type: 'date', required: true },
    { name: 'product', label: 'Product', type: 'product-select', required: true },
    { name: 'inventory', label: 'Inventory', type: 'number' },
    { name: 'sales', label: 'Sales (units)', type: 'number' },
    { name: 'fulfilled', label: 'Fulfilled', type: 'number' },
    { name: 'cancelled', label: 'Cancellations', type: 'number' },
    { name: 'returns', label: 'Returns', type: 'number' },
    { name: 'claims', label: 'Claims Filed', type: 'number' },
    { name: 'refunded', label: 'Refunded', type: 'number' },
    { name: 'replaced', label: 'Replacements', type: 'number' },
    { name: 'notes', label: 'Notes / Remarks', type: 'textarea', full: true }
  ]},
  shopify: { title: 'Shopify Operational Entry', fields: [
    { name: 'date', label: 'Date', type: 'date', required: true },
    { name: 'product', label: 'Product', type: 'product-select', required: true },
    { name: 'inventory', label: 'Inventory', type: 'number' },
    { name: 'sales', label: 'Sales (units)', type: 'number' },
    { name: 'fulfilled', label: 'Fulfilled', type: 'number' },
    { name: 'cancelled', label: 'Cancellations', type: 'number' },
    { name: 'returns', label: 'Returns', type: 'number' },
    { name: 'claims', label: 'Claims Filed', type: 'number' },
    { name: 'refunded', label: 'Refunded', type: 'number' },
    { name: 'replaced', label: 'Replacements', type: 'number' },
    { name: 'notes', label: 'Notes / Remarks', type: 'textarea', full: true }
  ]},
  marketing: { title: 'Marketing Entry', fields: [
    { name: 'date', label: 'Date', type: 'date', required: true },
    { name: 'type', label: 'Type', type: 'select', options: ['Coupon','Discount','Ads','Affiliate'], required: true },
    { name: 'channel', label: 'Channel', type: 'select', options: ['TikTok','Shopify','Meta','Google','Other'] },
    { name: 'campaign', label: 'Campaign / Code', type: 'text' },
    { name: 'spend', label: 'Spend ($)', type: 'number', step: 0.01 },
    { name: 'revenue', label: 'Attributed Revenue ($)', type: 'number', step: 0.01 },
    { name: 'notes', label: 'Notes', type: 'textarea', full: true }
  ]},
  inventory: { title: 'Product / Inventory', fields: [
    { name: 'product', label: 'Product Name', type: 'text', required: true },
    { name: 'sku', label: 'SKU', type: 'text' },
    { name: 'stock', label: 'Current Stock (units)', type: 'number' },
    { name: 'reorder', label: 'Reorder Threshold', type: 'number' },
    { name: 'cost', label: 'Cost per Unit ($)', type: 'number', step: 0.01, hint: 'Your cost (cost of goods sold).' },
    { name: 'price', label: 'Selling Price per Unit ($)', type: 'number', step: 0.01, hint: 'What you sell it for.' },
    { name: 'tiktok', label: 'Live on TikTok', type: 'checkbox' },
    { name: 'shopify', label: 'Live on Shopify', type: 'checkbox' },
    { name: 'other', label: 'Live on Other Store', type: 'checkbox' },
    { name: 'remarks', label: 'Remarks / Comments', type: 'textarea', full: true }
  ]},
  customer: { title: 'Customer Review', fields: [
    { name: 'date', label: 'Date', type: 'date', required: true },
    { name: 'channel', label: 'Channel', type: 'select', options: ['TikTok','Shopify','Other'] },
    { name: 'sentiment', label: 'Sentiment', type: 'select', options: ['Positive','Neutral','Negative'], required: true },
    { name: 'rating', label: 'Rating (1-5)', type: 'number', step: 1 },
    { name: 'category', label: 'Category', type: 'select', options: ['Product','Customer Service','Shop','Delivery','Other'] },
    { name: 'customer', label: 'Customer Name', type: 'text' },
    { name: 'comment', label: 'Comment', type: 'textarea', full: true },
    { name: 'status', label: 'Status', type: 'select', options: ['Open','In Progress','Resolved','Closed'] },
    { name: 'remarks', label: 'Internal Remarks', type: 'textarea', full: true }
  ]}
};

function openModal(type, id = null) {
  const schema = formSchemas[type];
  editing = { type, id };
  modalTitle.textContent = (id ? 'Edit ' : 'Add ') + schema.title;
  const existing = id ? state[type].find(r => r.id === id) : {};
  modalForm.innerHTML = schema.fields.map(f => {
    const val = existing[f.name] ?? (f.type === 'checkbox' ? false : '');
    const wrapClass = f.full ? 'full' : '';
    const hint = f.hint ? `<small style="display:block;color:#8b94b8;font-size:11px;margin-top:4px;">${f.hint}</small>` : '';
    if (f.type === 'product-select') {
      const options = productOptions();
      return `<label class="${wrapClass}">${f.label}<select name="${f.name}" ${f.required?'required':''} data-product-select="1"><option value="">— Select Product —</option>${options.map(o => `<option value="${o}" ${val===o?'selected':''}>${o}</option>`).join('')}</select>${hint}</label>`;
    }
    if (f.type === 'select') {
      return `<label class="${wrapClass}">${f.label}<select name="${f.name}" ${f.required?'required':''}><option value="">— Select —</option>${f.options.map(o => `<option value="${o}" ${val===o?'selected':''}>${o}</option>`).join('')}</select>${hint}</label>`;
    }
    if (f.type === 'textarea') return `<label class="${wrapClass}">${f.label}<textarea name="${f.name}">${val ?? ''}</textarea>${hint}</label>`;
    if (f.type === 'checkbox') return `<label class="${wrapClass}" style="flex-direction:row;align-items:center;gap:10px;"><input type="checkbox" name="${f.name}" ${val?'checked':''} style="width:auto;" /><span>${f.label}</span></label>`;
    const step = f.step ? `step="${f.step}"` : '';
    const ro = f.readonly ? 'data-readonly="1" style="background:rgba(124,92,255,0.08);"' : '';
    return `<label class="${wrapClass}">${f.label}<input type="${f.type}" name="${f.name}" value="${val ?? ''}" ${step} ${f.required?'required':''} ${ro} />${hint}</label>`;
  }).join('');
  
  // Auto-fill on product change (for sales form & channel forms)
  const productSelect = modalForm.querySelector('[data-product-select]');
  if (productSelect && type === 'sales') {
    const wireAutoFill = () => {
      const productName = productSelect.value;
      const product = findProduct(productName);
      if (product) {
        const priceInput = modalForm.querySelector('[name="price"]');
        const costInput = modalForm.querySelector('[name="cost"]');
        if (priceInput && !priceInput.value) priceInput.value = product.price || 0;
        if (costInput && !costInput.value) costInput.value = product.cost || 0;
        recalcRevenue();
      }
    };
    productSelect.addEventListener('change', wireAutoFill);
  }
  
  // Auto-calculate revenue from units × price (for sales form)
  function recalcRevenue() {
    if (type !== 'sales') return;
    const units = Number(modalForm.querySelector('[name="units"]')?.value || 0);
    const price = Number(modalForm.querySelector('[name="price"]')?.value || 0);
    const revInput = modalForm.querySelector('[name="revenue"]');
    if (revInput && !revInput.dataset.userEdited) {
      revInput.value = (units * price).toFixed(2);
    }
  }
  if (type === 'sales') {
    ['units','price'].forEach(n => {
      const el = modalForm.querySelector(`[name="${n}"]`);
      if (el) el.addEventListener('input', recalcRevenue);
    });
    const revEl = modalForm.querySelector('[name="revenue"]');
    if (revEl) {
      // Allow override by editing the revenue field directly
      revEl.removeAttribute('data-readonly');
      revEl.style.background = 'rgba(124,92,255,0.08)';
      revEl.addEventListener('input', () => { revEl.dataset.userEdited = '1'; });
    }
  }
  
  modal.classList.remove('hidden');
}

function closeModal() { modal.classList.add('hidden'); editing = null; modalForm.innerHTML = ''; }

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
  for (const f of schema.fields) {
    if (f.required && !record[f.name] && record[f.name] !== 0) { showToast(`${f.label} is required`); return; }
  }
  
  // FEATURE: when saving a sales entry, auto-link to channel tab
  if (type === 'sales' && !id) {
    state.sales.push(record);
    autoLinkSaleToChannel(record);
  } else if (type === 'sales' && id) {
    // For edits, also update linked channel record if any
    autoLinkSaleToChannel(record, id);
  } else if (!id) {
    state[type].push(record);
  }
  
  saveData(); closeModal(); renderAll(); showToast(id ? 'Entry updated' : 'Entry added');
});

// FEATURE 3: Auto-link sales tab to TikTok/Shopify operational tabs
function autoLinkSaleToChannel(sale, editingId) {
  const channelKey = sale.channel === 'TikTok' ? 'tiktok' : sale.channel === 'Shopify' ? 'shopify' : null;
  if (!channelKey) return;
  
  // Find existing operational record for same date+product+linkedSaleId
  const linkId = editingId || sale.id;
  let existing = state[channelKey].find(r => r._linkedSaleId === linkId);
  
  if (existing) {
    // Update existing linked record
    existing.date = sale.date;
    existing.product = sale.product;
    existing.sales = sale.units;
    existing.fulfilled = existing.fulfilled || sale.units;
  } else if (!editingId) {
    // Create new linked operational record
    state[channelKey].push({
      id: uid(),
      _linkedSaleId: sale.id,
      date: sale.date,
      product: sale.product,
      inventory: 0,
      sales: sale.units,
      fulfilled: sale.units,
      cancelled: 0,
      returns: 0,
      claims: 0,
      refunded: 0,
      replaced: 0,
      notes: '(Auto-linked from Sales tab)'
    });
  }
}

document.addEventListener('click', (e) => {
  const addBtn = e.target.closest('[data-add]');
  if (addBtn) { openModal(addBtn.dataset.add); return; }
  const editBtn = e.target.closest('[data-edit]');
  if (editBtn) { openModal(editBtn.dataset.edit, editBtn.dataset.id); return; }
  const delBtn = e.target.closest('[data-del]');
  if (delBtn) {
    const type = delBtn.dataset.del; const id = delBtn.dataset.id;
    if (confirm('Delete this entry?')) {
      // If deleting a sale, also delete linked channel record
      if (type === 'sales') {
        ['tiktok','shopify'].forEach(ch => {
          state[ch] = state[ch].filter(r => r._linkedSaleId !== id);
        });
      }
      state[type] = state[type].filter(r => r.id !== id);
      saveData(); renderAll(); showToast('Entry deleted');
    }
  }
});

['salesChannelFilter','marketingTypeFilter','inventoryStockFilter','inventorySearch','cxSentimentFilter','cxCategoryFilter'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('input', renderAll);
});

function filteredSales() { return state.sales.filter(r => inRange(r.date)); }
function filteredTikTok() { return state.tiktok.filter(r => inRange(r.date)); }
function filteredShopify() { return state.shopify.filter(r => inRange(r.date)); }
function filteredMarketing() { return state.marketing.filter(r => inRange(r.date)); }
function filteredCustomer() { return state.customer.filter(r => inRange(r.date)); }

// FEATURE 4: profit calculations
function saleGrossProfit(sale) {
  const units = Number(sale.units || 0);
  const revenue = Number(sale.revenue || 0);
  const cost = Number(sale.cost || 0);
  return revenue - (units * cost);
}

function execMetrics() {
  const sales = filteredSales(); const tt = filteredTikTok(); const sp = filteredShopify(); const mk = filteredMarketing();
  const totalRevenue = sales.reduce((a,b) => a + Number(b.revenue||0), 0);
  // FEATURE 2: Orders = number of transactions (not sum of units)
  const orders = sales.length;
  const unitsSold = sales.reduce((a,b) => a + Number(b.units||0), 0);
  const cancellations = tt.reduce((a,b)=>a+Number(b.cancelled||0),0) + sp.reduce((a,b)=>a+Number(b.cancelled||0),0);
  const returnsR = tt.reduce((a,b)=>a+Number(b.returns||0)+Number(b.refunded||0),0) + sp.reduce((a,b)=>a+Number(b.returns||0)+Number(b.refunded||0),0);
  const fulfilled = tt.reduce((a,b)=>a+Number(b.fulfilled||0),0) + sp.reduce((a,b)=>a+Number(b.fulfilled||0),0);
  const adSpend = mk.reduce((a,b)=>a+Number(b.spend||0),0);
  const adRevenue = mk.reduce((a,b)=>a+Number(b.revenue||0),0);
  const roas = adSpend > 0 ? (adRevenue / adSpend) : 0;
  // Profit
  const grossProfit = sales.reduce((a, s) => a + saleGrossProfit(s), 0);
  const netProfit = grossProfit - adSpend;
  const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
  return {
    totalRevenue, orders, unitsSold,
    aov: orders > 0 ? totalRevenue / orders : 0,
    cancellations,
    cancelRate: (cancellations + fulfilled) > 0 ? (cancellations/(cancellations+fulfilled))*100 : 0,
    returnsR,
    returnsRate: fulfilled > 0 ? (returnsR/fulfilled)*100 : 0,
    adSpend, roas, grossProfit, netProfit, profitMargin
  };
}

function renderExecutive() {
  const m = execMetrics();
  document.getElementById('kpiRevenue').textContent = usd(m.totalRevenue);
  document.getElementById('kpiOrders').textContent = num(m.orders);
  if (document.getElementById('kpiOrdersSub')) document.getElementById('kpiOrdersSub').textContent = num(m.unitsSold) + ' units';
  document.getElementById('kpiAOV').textContent = usd(m.aov);
  document.getElementById('kpiCancel').textContent = num(m.cancellations);
  document.getElementById('kpiCancelRate').textContent = pct(m.cancelRate) + ' rate';
  document.getElementById('kpiReturns').textContent = num(m.returnsR);
  document.getElementById('kpiReturnsRate').textContent = pct(m.returnsRate) + ' rate';
  document.getElementById('kpiROAS').textContent = (Math.round(m.roas*10)/10) + 'x';
  document.getElementById('kpiAdSpend').textContent = usd(m.adSpend) + ' spent';
  if (document.getElementById('kpiGrossProfit')) document.getElementById('kpiGrossProfit').textContent = usd(m.grossProfit);
  if (document.getElementById('kpiNetProfit')) document.getElementById('kpiNetProfit').textContent = usd(m.netProfit);
  if (document.getElementById('kpiProfitMargin')) document.getElementById('kpiProfitMargin').textContent = pct(m.profitMargin);

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
  const mix = channels.map(ch => sales.filter(r=>r.channel===ch).reduce((a,b)=>a+Number(b.revenue||0),0));
  drawChart('execMixChart', 'doughnut', { labels: channels, datasets: [{ data: mix, backgroundColor: ['#7c5cff','#22d3ee','#34d399'], borderWidth: 0 }] });

  // Top products by revenue
  const totals = new Map();
  sales.forEach(r => {
    const k = `${r.product}||${r.channel}`;
    const t = totals.get(k) || { product: r.product, channel: r.channel, units: 0, revenue: 0 };
    t.units += Number(r.units||0); t.revenue += Number(r.revenue||0);
    totals.set(k, t);
  });
  const top = Array.from(totals.values()).sort((a,b)=>b.revenue-a.revenue).slice(0,6);
  const topBody = document.querySelector('#topProductsTable tbody');
  topBody.innerHTML = top.length ? top.map(t => `<tr><td>${t.product}</td><td><span class="pill ${t.channel==='TikTok'?'purple':t.channel==='Shopify'?'blue':'gray'}">${t.channel}</span></td><td>${num(t.units)}</td><td>${usd(t.revenue)}</td></tr>`).join('') : `<tr><td colspan="4" class="empty">No sales in range</td></tr>`;

  const activity = [
    ...sales.slice(-5).map(r => ({ when: r.date, text: `Sale: ${r.product} on ${r.channel} — ${usd(r.revenue)}` })),
    ...filteredCustomer().slice(-3).map(r => ({ when: r.date, text: `${r.sentiment} review (${r.category}) from ${r.customer || 'customer'}` })),
    ...filteredMarketing().slice(-3).map(r => ({ when: r.date, text: `${r.type} — ${r.campaign || ''} on ${r.channel || ''}` }))
  ].sort((a,b) => (b.when||'').localeCompare(a.when||'')).slice(0,8);
  document.getElementById('activityList').innerHTML = activity.length ? activity.map(a => `<li><span class="dot"></span><span>${a.text}</span><span class="a-meta">${a.when || ''}</span></li>`).join('') : `<li class="empty">No recent activity</li>`;
}

function renderSales() {
  const channelFilter = document.getElementById('salesChannelFilter').value;
  const rows = filteredSales().filter(r => !channelFilter || r.channel === channelFilter).sort((a,b) => (b.date||'').localeCompare(a.date||''));
  const body = document.querySelector('#salesTable tbody');
  body.innerHTML = rows.length ? rows.map(r => {
    const profit = saleGrossProfit(r);
    return `<tr><td>${r.date}</td><td><span class="pill ${r.channel==='TikTok'?'purple':r.channel==='Shopify'?'blue':'gray'}">${r.channel}</span></td><td>${r.product}</td><td>${num(r.units)}</td><td>${usd(r.revenue)}</td><td style="color:${profit>=0?'#34d399':'#f87171'};">${usd(profit)}</td><td>${r.notes || ''}</td><td><div class="row-actions"><button data-edit="sales" data-id="${r.id}">Edit</button><button class="danger" data-del="sales" data-id="${r.id}">Delete</button></div></td></tr>`;
  }).join('') : `<tr><td colspan="8" class="empty">No sales in range. Click "+ Add Sale Entry".</td></tr>`;

  const trend = groupByBucket(filteredSales(), r => r.revenue);
  drawChart('salesTrendChart', 'line', { labels: trend.map(t=>t[0]), datasets: [{ label: 'Revenue', data: trend.map(t=>t[1]), borderColor: '#7c5cff', backgroundColor: 'rgba(124,92,255,0.18)', fill:true, tension:0.35, borderWidth:2 }] });
  const chans = ['TikTok','Shopify','Other'];
  drawChart('salesChannelChart', 'bar', { labels: chans, datasets: [{ label: 'Revenue', data: chans.map(c => filteredSales().filter(r=>r.channel===c).reduce((a,b)=>a+Number(b.revenue||0),0)), backgroundColor: ['#7c5cff','#22d3ee','#34d399'], borderRadius: 8 }] });
}

function renderChannel(type, prefix) {
  const data = type === 'tiktok' ? filteredTikTok() : filteredShopify();
  const sales = filteredSales().filter(r => r.channel === (type==='tiktok'?'TikTok':'Shopify'));
  document.getElementById(`${prefix}Revenue`).textContent = usd(sales.reduce((a,b)=>a+Number(b.revenue||0),0));
  document.getElementById(`${prefix}Fulfilled`).textContent = num(data.reduce((a,b)=>a+Number(b.fulfilled||0),0));
  document.getElementById(`${prefix}Cancel`).textContent = num(data.reduce((a,b)=>a+Number(b.cancelled||0),0));
  document.getElementById(`${prefix}Returns`).textContent = num(data.reduce((a,b)=>a+Number(b.returns||0)+Number(b.refunded||0),0));

  const rows = data.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const body = document.querySelector(`#${type}Table tbody`);
  body.innerHTML = rows.length ? rows.map(r => {
    const linkedTag = r._linkedSaleId ? '<span class="pill purple" style="font-size:10px;">🔗 Linked</span> ' : '';
    return `<tr><td>${r.date}</td><td>${linkedTag}${r.product}</td><td>${num(r.inventory)}</td><td>${num(r.sales)}</td><td>${num(r.fulfilled)}</td><td>${num(r.cancelled)}</td><td>${num(r.returns)}</td><td>${num(r.claims)}</td><td>${num(r.refunded)}</td><td>${num(r.replaced)}</td><td>${r.notes || ''}</td><td><div class="row-actions"><button data-edit="${type}" data-id="${r.id}">Edit</button><button class="danger" data-del="${type}" data-id="${r.id}">Delete</button></div></td></tr>`;
  }).join('') : `<tr><td colspan="12" class="empty">No entries.</td></tr>`;

  const labels = Array.from(new Set(data.map(r => bucketKey(r.date)))).sort();
  const series = (key) => labels.map(l => data.filter(r => bucketKey(r.date)===l).reduce((a,b)=>a+Number(b[key]||0),0));
  drawChart(`${type}TrendChart`, 'line', { labels, datasets: [
    { label: 'Sales', data: series('sales'), borderColor: '#7c5cff', backgroundColor:'rgba(124,92,255,0.15)', tension:0.35, fill:true, borderWidth:2 },
    { label: 'Fulfilled', data: series('fulfilled'), borderColor: '#34d399', backgroundColor:'rgba(52,211,153,0.12)', tension:0.35, fill:true, borderWidth:2 },
    { label: 'Cancelled', data: series('cancelled'), borderColor: '#fbbf24', backgroundColor:'rgba(251,191,36,0.12)', tension:0.35, fill:false, borderWidth:2 },
    { label: 'Returns', data: series('returns'), borderColor: '#f87171', backgroundColor:'rgba(248,113,113,0.12)', tension:0.35, fill:false, borderWidth:2 }
  ]});
}

function renderMarketing() {
  const typeFilter = document.getElementById('marketingTypeFilter').value;
  const data = filteredMarketing().filter(r => !typeFilter || r.type === typeFilter);
  const totalSpend = data.reduce((a,b)=>a+Number(b.spend||0),0);
  const totalRev = data.reduce((a,b)=>a+Number(b.revenue||0),0);
  const discountRows = data.filter(r => r.type === 'Coupon' || r.type === 'Discount');
  document.getElementById('mkSpend').textContent = usd(totalSpend);
  document.getElementById('mkRevenue').textContent = usd(totalRev);
  document.getElementById('mkROAS').textContent = (totalSpend>0 ? (totalRev/totalSpend) : 0).toFixed(1) + 'x';
  document.getElementById('mkDiscounts').textContent = usd(discountRows.reduce((a,b)=>a+Number(b.revenue||0),0));

  const body = document.querySelector('#marketingTable tbody');
  const rows = data.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  body.innerHTML = rows.length ? rows.map(r => {
    const roas = Number(r.spend) > 0 ? (Number(r.revenue||0)/Number(r.spend)).toFixed(1) + 'x' : '—';
    const tCol = { Coupon:'green', Discount:'yellow', Ads:'purple', Affiliate:'blue' }[r.type] || 'gray';
    return `<tr><td>${r.date}</td><td><span class="pill ${tCol}">${r.type}</span></td><td>${r.channel || ''}</td><td>${r.campaign || ''}</td><td>${usd(r.spend)}</td><td>${usd(r.revenue)}</td><td>${roas}</td><td>${r.notes || ''}</td><td><div class="row-actions"><button data-edit="marketing" data-id="${r.id}">Edit</button><button class="danger" data-del="marketing" data-id="${r.id}">Delete</button></div></td></tr>`;
  }).join('') : `<tr><td colspan="9" class="empty">No marketing entries.</td></tr>`;

  const labels = Array.from(new Set(data.map(r => bucketKey(r.date)))).sort();
  drawChart('mkSpendChart', 'bar', { labels, datasets: [
    { label: 'Spend', data: labels.map(l => data.filter(r => bucketKey(r.date)===l).reduce((a,b)=>a+Number(b.spend||0),0)), backgroundColor: '#7c5cff', borderRadius: 6 },
    { label: 'Revenue', data: labels.map(l => data.filter(r => bucketKey(r.date)===l).reduce((a,b)=>a+Number(b.revenue||0),0)), backgroundColor: '#22d3ee', borderRadius: 6 }
  ]});
  const types = ['Coupon','Discount','Ads','Affiliate'];
  drawChart('mkTypeChart', 'doughnut', { labels: types, datasets: [{ data: types.map(t => data.filter(r=>r.type===t).reduce((a,b)=>a+Number(b.spend||0),0)), backgroundColor: ['#34d399','#fbbf24','#7c5cff','#22d3ee'], borderWidth: 0 }] });
}

function stockLevel(stock, reorder) {
  stock = Number(stock||0); reorder = Number(reorder||0);
  if (stock <= 0) return { label: 'Critical', cls: 'red', remark: 'Out of stock' };
  if (stock < reorder * 0.5) return { label: 'Critical', cls: 'red', remark: 'Replenish urgently' };
  if (stock < reorder) return { label: 'Low', cls: 'yellow', remark: 'Reorder recommended' };
  if (stock > reorder * 4) return { label: 'Overstock', cls: 'blue', remark: 'Consider promotions' };
  return { label: 'Healthy', cls: 'green', remark: 'OK' };
}

function renderInventory() {
  const stockFilter = document.getElementById('inventoryStockFilter').value;
  const search = (document.getElementById('inventorySearch').value || '').toLowerCase();
  const rows = state.inventory.map(r => ({ ...r, _level: stockLevel(r.stock, r.reorder) })).filter(r => !stockFilter || r._level.label === stockFilter).filter(r => !search || (r.product+' '+r.sku).toLowerCase().includes(search));
  const body = document.querySelector('#inventoryTable tbody');
  body.innerHTML = rows.length ? rows.map(r => {
    const margin = r.price > 0 ? ((r.price - r.cost) / r.price) * 100 : 0;
    const marginColor = margin >= 50 ? 'green' : margin >= 25 ? 'yellow' : 'red';
    return `<tr><td><strong>${r.product}</strong></td><td>${r.sku || ''}</td><td>${num(r.stock)}</td><td><span class="pill ${r._level.cls}">${r._level.label}</span></td><td>${usd2(r.cost)}</td><td>${usd2(r.price)}</td><td><span class="pill ${marginColor}">${margin.toFixed(0)}%</span></td><td>${r.tiktok ? '<span class="pill purple">Live</span>' : '<span class="pill gray">—</span>'}</td><td>${r.shopify ? '<span class="pill blue">Live</span>' : '<span class="pill gray">—</span>'}</td><td>${r.other ? '<span class="pill green">Live</span>' : '<span class="pill gray">—</span>'}</td><td>${num(r.reorder)}</td><td>${r.remarks || r._level.remark}</td><td><div class="row-actions"><button data-edit="inventory" data-id="${r.id}">Edit</button><button class="danger" data-del="inventory" data-id="${r.id}">Delete</button></div></td></tr>`;
  }).join('') : `<tr><td colspan="13" class="empty">No products. Add one to start.</td></tr>`;

  const levels = ['Critical','Low','Healthy','Overstock'];
  drawChart('invHealthChart', 'doughnut', { labels: levels, datasets: [{ data: levels.map(l => state.inventory.filter(p => stockLevel(p.stock,p.reorder).label===l).length), backgroundColor: ['#f87171','#fbbf24','#34d399','#22d3ee'], borderWidth: 0 }] });
  drawChart('invCoverageChart', 'bar', { labels: ['TikTok','Shopify','Other'], datasets: [{ label: 'Products Listed', data: [state.inventory.filter(p=>p.tiktok).length, state.inventory.filter(p=>p.shopify).length, state.inventory.filter(p=>p.other).length], backgroundColor: ['#7c5cff','#22d3ee','#34d399'], borderRadius: 8 }] });
}

function renderCustomer() {
  const data = filteredCustomer();
  const sentFilter = document.getElementById('cxSentimentFilter').value;
  const catFilter = document.getElementById('cxCategoryFilter').value;
  const rows = data.filter(r => !sentFilter || r.sentiment === sentFilter).filter(r => !catFilter || r.category === catFilter).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
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
    return `<tr><td>${r.date}</td><td>${r.channel || ''}</td><td><span class="pill ${sCol}">${r.sentiment}</span></td><td>${r.rating ? '★'.repeat(Number(r.rating)) : ''}</td><td>${r.category || ''}</td><td>${r.customer || ''}</td><td>${r.comment || ''}</td><td><span class="pill ${stCol}">${r.status || 'Open'}</span></td><td>${r.remarks || ''}</td><td><div class="row-actions"><button data-edit="customer" data-id="${r.id}">Edit</button><button class="danger" data-del="customer" data-id="${r.id}">Delete</button></div></td></tr>`;
  }).join('') : `<tr><td colspan="10" class="empty">No reviews.</td></tr>`;

  const labels = Array.from(new Set(data.map(r => bucketKey(r.date)))).sort();
  drawChart('cxSentimentChart', 'line', { labels, datasets: [
    { label: 'Positive', data: labels.map(l => data.filter(r=>bucketKey(r.date)===l && r.sentiment==='Positive').length), borderColor: '#34d399', backgroundColor:'rgba(52,211,153,0.18)', tension:0.35, fill:true, borderWidth:2 },
    { label: 'Negative', data: labels.map(l => data.filter(r=>bucketKey(r.date)===l && r.sentiment==='Negative').length), borderColor: '#f87171', backgroundColor:'rgba(248,113,113,0.18)', tension:0.35, fill:true, borderWidth:2 },
    { label: 'Neutral', data: labels.map(l => data.filter(r=>bucketKey(r.date)===l && r.sentiment==='Neutral').length), borderColor: '#8b94b8', backgroundColor:'rgba(139,148,184,0.18)', tension:0.35, fill:true, borderWidth:2 }
  ]});
  const cats = ['Product','Customer Service','Shop','Delivery','Other'];
  drawChart('cxCategoryChart', 'bar', { labels: cats, datasets: [{ label: 'Complaints', data: cats.map(c => data.filter(r=>r.sentiment==='Negative' && r.category===c).length), backgroundColor: ['#7c5cff','#22d3ee','#fbbf24','#f87171','#8b94b8'], borderRadius: 8 }] });
}

// FEATURE 5: Profitability view
function renderProfitability() {
  if (!document.getElementById('view-profitability')) return;
  const sales = filteredSales();
  const mk = filteredMarketing();
  
  const totalRevenue = sales.reduce((a,b) => a + Number(b.revenue||0), 0);
  const totalCOGS = sales.reduce((a,s) => a + (Number(s.units||0) * Number(s.cost||0)), 0);
  const grossProfit = totalRevenue - totalCOGS;
  const adSpend = mk.reduce((a,b) => a + Number(b.spend||0), 0);
  const netProfit = grossProfit - adSpend;
  const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
  const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  
  document.getElementById('pfRevenue').textContent = usd(totalRevenue);
  document.getElementById('pfCOGS').textContent = usd(totalCOGS);
  document.getElementById('pfGrossProfit').textContent = usd(grossProfit);
  document.getElementById('pfGrossProfit').style.color = grossProfit >= 0 ? '#34d399' : '#f87171';
  document.getElementById('pfAdSpend').textContent = usd(adSpend);
  document.getElementById('pfNetProfit').textContent = usd(netProfit);
  document.getElementById('pfNetProfit').style.color = netProfit >= 0 ? '#34d399' : '#f87171';
  document.getElementById('pfGrossMargin').textContent = pct(grossMargin);
  document.getElementById('pfNetMargin').textContent = pct(netMargin);
  
  // Per-product profitability
  const byProduct = new Map();
  sales.forEach(s => {
    const k = s.product || 'Unknown';
    const cur = byProduct.get(k) || { product: k, units: 0, revenue: 0, cogs: 0 };
    cur.units += Number(s.units||0);
    cur.revenue += Number(s.revenue||0);
    cur.cogs += Number(s.units||0) * Number(s.cost||0);
    byProduct.set(k, cur);
  });
  const productRows = Array.from(byProduct.values()).map(p => ({
    ...p,
    profit: p.revenue - p.cogs,
    margin: p.revenue > 0 ? ((p.revenue - p.cogs) / p.revenue) * 100 : 0
  })).sort((a,b) => b.profit - a.profit);
  
  const pBody = document.querySelector('#profitProductTable tbody');
  pBody.innerHTML = productRows.length ? productRows.map(p => {
    const marginCol = p.margin >= 50 ? 'green' : p.margin >= 25 ? 'yellow' : 'red';
    return `<tr><td><strong>${p.product}</strong></td><td>${num(p.units)}</td><td>${usd(p.revenue)}</td><td>${usd(p.cogs)}</td><td style="color:${p.profit>=0?'#34d399':'#f87171'};font-weight:600;">${usd(p.profit)}</td><td><span class="pill ${marginCol}">${p.margin.toFixed(0)}%</span></td></tr>`;
  }).join('') : `<tr><td colspan="6" class="empty">No sales data yet. Add sales with product cost & price to see profitability.</td></tr>`;
  
  // Profit trend chart
  const labels = Array.from(new Set(sales.map(r => bucketKey(r.date)))).sort();
  const profitSeries = labels.map(l => {
    const ds = sales.filter(r => bucketKey(r.date) === l);
    return ds.reduce((a, s) => a + saleGrossProfit(s), 0);
  });
  const revSeries = labels.map(l => sales.filter(r => bucketKey(r.date) === l).reduce((a,b) => a + Number(b.revenue||0), 0));
  drawChart('profitTrendChart', 'line', {
    labels,
    datasets: [
      { label: 'Revenue', data: revSeries, borderColor: '#22d3ee', backgroundColor: 'rgba(34,211,238,0.15)', tension: 0.35, fill: true, borderWidth: 2 },
      { label: 'Gross Profit', data: profitSeries, borderColor: '#34d399', backgroundColor: 'rgba(52,211,153,0.15)', tension: 0.35, fill: true, borderWidth: 2 }
    ]
  });
  
  // Profit breakdown bar
  drawChart('profitBreakdownChart', 'bar', {
    labels: ['Revenue','COGS','Gross Profit','Ad Spend','Net Profit'],
    datasets: [{ label: '$', data: [totalRevenue, totalCOGS, grossProfit, adSpend, netProfit], backgroundColor: ['#22d3ee','#fbbf24','#34d399','#7c5cff', netProfit >= 0 ? '#10b981' : '#f87171'], borderRadius: 8 }]
  });
}

function chartTextColor() { return getComputedStyle(document.body).getPropertyValue('--text').trim() || '#e8ecf8'; }
function chartGrid() { return (state.settings && state.settings.theme === 'light') ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'; }
function drawChart(canvasId, type, data) {
  const el = document.getElementById(canvasId);
  if (!el) return;
  if (charts[canvasId]) charts[canvasId].destroy();
  const opts = {
    responsive: true,
    plugins: { legend: { labels: { color: chartTextColor(), font: { family: 'Inter', size: 11.5 } } }, tooltip: { backgroundColor: 'rgba(15,21,43,0.95)', borderColor: 'rgba(124,92,255,0.4)', borderWidth: 1 } },
    scales: (type === 'doughnut' || type === 'pie') ? {} : { x: { ticks: { color: chartTextColor() }, grid: { color: chartGrid() } }, y: { ticks: { color: chartTextColor() }, grid: { color: chartGrid() }, beginAtZero: true } }
  };
  charts[canvasId] = new Chart(el, { type, data, options: opts });
}

function renderAll() {
  if (!isReady) return;
  renderExecutive(); renderSales(); renderChannel('tiktok', 'tt'); renderChannel('shopify', 'sp'); renderMarketing(); renderInventory(); renderCustomer(); renderProfitability();
}

initFirebase();
