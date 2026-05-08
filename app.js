/* TGP Ultimate Dashboard v3
   - Sales-focused (no profit calculations)
   - Returns & Refunds, Customers (records + reviews)
   - Excel / CSV / PDF / JSON import
   - Mobile / tablet / desktop responsive
*/

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
  sales: [], tiktok: [], shopify: [], marketing: [], inventory: [],
  customer: [],   // reviews (kept name for backward compat)
  customers: [],  // customer records (new)
  returns: [],    // return records (new)
  settings: { theme: 'dark' }
};

function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }

let state = JSON.parse(JSON.stringify(defaultData));
let dateRange = { from: null, to: null, grain: 'day' };
const charts = {};
let isReady = false;
let saveTimer = null;

// ============================================================
// MIGRATION — keep existing data, add new collections safely
// ============================================================
function migrateData(d) {
  if (!d) return d;
  if (!Array.isArray(d.customers)) d.customers = [];
  if (!Array.isArray(d.returns)) d.returns = [];
  (d.inventory || []).forEach(p => {
    if (p.cost === undefined) p.cost = 0;
    if (p.price === undefined) p.price = 0;
  });
  (d.sales || []).forEach(s => {
    if (s.price === undefined) s.price = s.units > 0 ? Number(s.revenue || 0) / Number(s.units) : 0;
  });
  return d;
}

async function initFirebase() {
  try {
    showSyncStatus('Connecting…');
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
      showSyncStatus('Saving…');
      await setDoc(DASHBOARD_DOC, state);
      showSyncStatus('✓ Saved');
    } catch { showSyncStatus('⚠ Save failed'); }
  }, 500);
}

function showSyncStatus(msg) {
  let el = document.getElementById('syncStatus');
  if (!el) {
    el = document.createElement('div');
    el.id = 'syncStatus';
    el.className = 'sync-status';
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
  t._timer = setTimeout(() => t.classList.add('hidden'), 2400);
}

const titles = {
  executive: 'Executive Summary',
  sales: 'Sales Report',
  returns: 'Returns & Refunds',
  tiktok: 'TikTok Shop',
  shopify: 'Shopify',
  marketing: 'Marketing & Coupons',
  inventory: 'Inventory',
  customer: 'Customers'
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

document.getElementById('importBtn').addEventListener('click', openImportModal);

const modal = document.getElementById('modal');
const modalForm = document.getElementById('modalForm');
const modalTitle = document.getElementById('modalTitle');
let editing = null;

function productOptions() {
  return state.inventory.map(p => p.product).filter(Boolean);
}
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
    { name: 'revenue', label: 'Total Sale ($) — auto-calculated', type: 'number', step: 0.01, hint: 'Units × Price. You can override.' },
    { name: 'customer', label: 'Customer Name (optional)', type: 'text' },
    { name: 'orderRef', label: 'Order # / Reference (optional)', type: 'text' },
    { name: 'notes', label: 'Notes / Remarks', type: 'textarea', full: true }
  ]},
  returns: { title: 'Return / Refund Record', fields: [
    { name: 'date', label: 'Date', type: 'date', required: true },
    { name: 'channel', label: 'Channel', type: 'select', options: ['TikTok','Shopify','Other'], required: true },
    { name: 'product', label: 'Product', type: 'product-select', required: true },
    { name: 'units', label: 'Units Returned', type: 'number', step: 1 },
    { name: 'refundAmount', label: 'Refund Amount ($)', type: 'number', step: 0.01 },
    { name: 'reason', label: 'Reason', type: 'select', options: ['Defective','Wrong Item','Not as Described','Damaged in Shipping','Customer Changed Mind','Late Delivery','Other'] },
    { name: 'status', label: 'Status', type: 'select', options: ['Pending','Approved','Refunded','Replaced','Rejected'] },
    { name: 'customer', label: 'Customer Name', type: 'text' },
    { name: 'orderRef', label: 'Original Order #', type: 'text' },
    { name: 'notes', label: 'Notes', type: 'textarea', full: true }
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
  marketing: { title: 'Marketing / Coupon Entry', fields: [
    { name: 'date', label: 'Date', type: 'date', required: true },
    { name: 'type', label: 'Type', type: 'select', options: ['Coupon','Discount','Ads','Affiliate'], required: true },
    { name: 'channel', label: 'Channel', type: 'select', options: ['TikTok','Shopify','Meta','Google','Other'] },
    { name: 'campaign', label: 'Campaign / Coupon Code', type: 'text' },
    { name: 'redemptions', label: 'Redemptions / Uses', type: 'number', hint: 'For coupons & discounts' },
    { name: 'spend', label: 'Spend ($)', type: 'number', step: 0.01 },
    { name: 'revenue', label: 'Attributed Revenue ($)', type: 'number', step: 0.01 },
    { name: 'notes', label: 'Notes', type: 'textarea', full: true }
  ]},
  inventory: { title: 'Product / Inventory', fields: [
    { name: 'product', label: 'Product Name', type: 'text', required: true },
    { name: 'sku', label: 'SKU', type: 'text' },
    { name: 'stock', label: 'Current Stock (units)', type: 'number' },
    { name: 'reorder', label: 'Reorder Threshold', type: 'number' },
    { name: 'price', label: 'Selling Price per Unit ($)', type: 'number', step: 0.01 },
    { name: 'tiktok', label: 'Live on TikTok', type: 'checkbox' },
    { name: 'shopify', label: 'Live on Shopify', type: 'checkbox' },
    { name: 'other', label: 'Live on Other Store', type: 'checkbox' },
    { name: 'remarks', label: 'Remarks / Comments', type: 'textarea', full: true }
  ]},
  customers: { title: 'Customer Record', fields: [
    { name: 'name', label: 'Customer Name', type: 'text', required: true },
    { name: 'email', label: 'Email', type: 'text' },
    { name: 'phone', label: 'Phone', type: 'text' },
    { name: 'channel', label: 'Primary Channel', type: 'select', options: ['TikTok','Shopify','Other','Multiple'] },
    { name: 'firstOrder', label: 'First Order Date', type: 'date' },
    { name: 'lastOrder', label: 'Last Order Date', type: 'date' },
    { name: 'totalOrders', label: 'Total Orders', type: 'number' },
    { name: 'totalSpent', label: 'Total Spent ($)', type: 'number', step: 0.01 },
    { name: 'returnsCount', label: 'Returns Count', type: 'number' },
    { name: 'status', label: 'Status', type: 'select', options: ['New','Active','VIP','Inactive'] },
    { name: 'tags', label: 'Tags (comma-separated)', type: 'text' },
    { name: 'notes', label: 'Notes', type: 'textarea', full: true }
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
    const hint = f.hint ? `<small class="form-hint">${f.hint}</small>` : '';
    if (f.type === 'product-select') {
      const options = productOptions();
      return `<label class="${wrapClass}">${f.label}<select name="${f.name}" ${f.required?'required':''} data-product-select="1"><option value="">— Select Product —</option>${options.map(o => `<option value="${o}" ${val===o?'selected':''}>${o}</option>`).join('')}</select>${hint}</label>`;
    }
    if (f.type === 'select') {
      return `<label class="${wrapClass}">${f.label}<select name="${f.name}" ${f.required?'required':''}><option value="">— Select —</option>${f.options.map(o => `<option value="${o}" ${val===o?'selected':''}>${o}</option>`).join('')}</select>${hint}</label>`;
    }
    if (f.type === 'textarea') return `<label class="${wrapClass}">${f.label}<textarea name="${f.name}">${val ?? ''}</textarea>${hint}</label>`;
    if (f.type === 'checkbox') return `<label class="${wrapClass} checkbox-row"><input type="checkbox" name="${f.name}" ${val?'checked':''} /><span>${f.label}</span></label>`;
    const step = f.step ? `step="${f.step}"` : '';
    return `<label class="${wrapClass}">${f.label}<input type="${f.type}" name="${f.name}" value="${val ?? ''}" ${step} ${f.required?'required':''} />${hint}</label>`;
  }).join('');

  // Auto-fill price for sales form
  const productSelect = modalForm.querySelector('[data-product-select]');
  if (productSelect && type === 'sales') {
    productSelect.addEventListener('change', () => {
      const product = findProduct(productSelect.value);
      if (product) {
        const priceInput = modalForm.querySelector('[name="price"]');
        if (priceInput && !priceInput.value) priceInput.value = product.price || 0;
        recalcRevenue();
      }
    });
  }
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
    if (revEl) revEl.addEventListener('input', () => { revEl.dataset.userEdited = '1'; });
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

  if (type === 'sales' && !id) {
    state.sales.push(record);
    autoLinkSaleToChannel(record);
  } else if (type === 'sales' && id) {
    autoLinkSaleToChannel(record, id);
  } else if (!id) {
    state[type].push(record);
  }

  saveData(); closeModal(); renderAll(); showToast(id ? 'Entry updated' : 'Entry added');
});

function autoLinkSaleToChannel(sale, editingId) {
  const channelKey = sale.channel === 'TikTok' ? 'tiktok' : sale.channel === 'Shopify' ? 'shopify' : null;
  if (!channelKey) return;
  const linkId = editingId || sale.id;
  let existing = state[channelKey].find(r => r._linkedSaleId === linkId);
  if (existing) {
    existing.date = sale.date;
    existing.product = sale.product;
    existing.sales = sale.units;
    existing.fulfilled = existing.fulfilled || sale.units;
  } else if (!editingId) {
    state[channelKey].push({
      id: uid(), _linkedSaleId: sale.id,
      date: sale.date, product: sale.product,
      inventory: 0, sales: sale.units, fulfilled: sale.units,
      cancelled: 0, returns: 0, claims: 0, refunded: 0, replaced: 0,
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

['salesChannelFilter','marketingTypeFilter','inventoryStockFilter','inventorySearch','cxSentimentFilter','cxCategoryFilter','returnsChannelFilter','returnsStatusFilter','customersStatusFilter','customersSearch']
  .forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', renderAll);
  });

function filteredSales() { return state.sales.filter(r => inRange(r.date)); }
function filteredTikTok() { return state.tiktok.filter(r => inRange(r.date)); }
function filteredShopify() { return state.shopify.filter(r => inRange(r.date)); }
function filteredMarketing() { return state.marketing.filter(r => inRange(r.date)); }
function filteredCustomer() { return state.customer.filter(r => inRange(r.date)); }
function filteredReturns() { return state.returns.filter(r => inRange(r.date)); }

function execMetrics() {
  const sales = filteredSales();
  const tt = filteredTikTok();
  const sp = filteredShopify();
  const mk = filteredMarketing();
  const ret = filteredReturns();
  const reviews = filteredCustomer();

  const totalRevenue = sales.reduce((a,b) => a + Number(b.revenue||0), 0);
  const orders = sales.length;
  const unitsSold = sales.reduce((a,b) => a + Number(b.units||0), 0);
  const cancellations = tt.reduce((a,b)=>a+Number(b.cancelled||0),0) + sp.reduce((a,b)=>a+Number(b.cancelled||0),0);
  const fulfilled = tt.reduce((a,b)=>a+Number(b.fulfilled||0),0) + sp.reduce((a,b)=>a+Number(b.fulfilled||0),0);
  const returnsCount = ret.reduce((a,b) => a + Number(b.units||0), 0)
    + tt.reduce((a,b)=>a+Number(b.returns||0),0) + sp.reduce((a,b)=>a+Number(b.returns||0),0);
  const refundAmount = ret.reduce((a,b) => a + Number(b.refundAmount||0), 0);
  const adSpend = mk.reduce((a,b)=>a+Number(b.spend||0),0);
  const adRevenue = mk.reduce((a,b)=>a+Number(b.revenue||0),0);
  const roas = adSpend > 0 ? (adRevenue / adSpend) : 0;
  const couponRedemptions = mk.filter(m => m.type === 'Coupon' || m.type === 'Discount').reduce((a,b) => a + Number(b.redemptions||0), 0);
  const discountValue = mk.filter(m => m.type === 'Coupon' || m.type === 'Discount').reduce((a,b) => a + Number(b.revenue||0), 0);
  const totalCustomers = state.customers.length;
  const ratings = reviews.map(r=>Number(r.rating||0)).filter(n=>n>0);
  const avgRating = ratings.length ? (ratings.reduce((a,b)=>a+b,0)/ratings.length) : 0;

  const ttRevenue = sales.filter(r=>r.channel==='TikTok').reduce((a,b)=>a+Number(b.revenue||0),0);
  const spRevenue = sales.filter(r=>r.channel==='Shopify').reduce((a,b)=>a+Number(b.revenue||0),0);

  return {
    totalRevenue, orders, unitsSold,
    aov: orders > 0 ? totalRevenue / orders : 0,
    cancellations,
    cancelRate: (cancellations + fulfilled) > 0 ? (cancellations/(cancellations+fulfilled))*100 : 0,
    returnsCount, refundAmount,
    returnsRate: fulfilled > 0 ? (returnsCount/fulfilled)*100 : 0,
    adSpend, roas, couponRedemptions, discountValue,
    totalCustomers, avgRating, ttRevenue, spRevenue
  };
}

function renderExecutive() {
  const m = execMetrics();
  setText('kpiRevenue', usd(m.totalRevenue));
  setText('kpiOrders', num(m.orders));
  setText('kpiOrdersSub', num(m.unitsSold) + ' units');
  setText('kpiAOV', usd(m.aov));
  setText('kpiCancel', num(m.cancellations));
  setText('kpiCancelRate', pct(m.cancelRate) + ' rate');
  setText('kpiReturns', num(m.returnsCount));
  setText('kpiReturnsRate', pct(m.returnsRate) + ' rate');
  setText('kpiROAS', (Math.round(m.roas*10)/10) + '×');
  setText('kpiAdSpend', usd(m.adSpend) + ' spent');
  setText('kpiCustomers', num(m.totalCustomers));
  setText('kpiCoupons', num(m.couponRedemptions));
  setText('kpiDiscountValue', usd(m.discountValue));
  setText('kpiRating', m.avgRating.toFixed(1));
  setText('kpiTTRev', usd(m.ttRevenue));
  setText('kpiSPRev', usd(m.spRevenue));
  setText('kpiRefundAmount', usd(m.refundAmount));

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
    ...filteredReturns().slice(-3).map(r => ({ when: r.date, text: `Return: ${r.product} (${r.channel}) — ${usd(r.refundAmount)} refund` })),
    ...filteredCustomer().slice(-3).map(r => ({ when: r.date, text: `${r.sentiment} review (${r.category}) from ${r.customer || 'customer'}` })),
    ...filteredMarketing().slice(-3).map(r => ({ when: r.date, text: `${r.type} — ${r.campaign || ''} on ${r.channel || ''}` }))
  ].sort((a,b) => (b.when||'').localeCompare(a.when||'')).slice(0,8);
  document.getElementById('activityList').innerHTML = activity.length ? activity.map(a => `<li><span class="dot"></span><span>${a.text}</span><span class="a-meta">${a.when || ''}</span></li>`).join('') : `<li class="empty">No recent activity</li>`;
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function renderSales() {
  const channelFilter = document.getElementById('salesChannelFilter').value;
  const rows = filteredSales().filter(r => !channelFilter || r.channel === channelFilter).sort((a,b) => (b.date||'').localeCompare(a.date||''));
  const body = document.querySelector('#salesTable tbody');
  body.innerHTML = rows.length ? rows.map(r => {
    return `<tr>
      <td>${r.date}</td>
      <td><span class="pill ${r.channel==='TikTok'?'purple':r.channel==='Shopify'?'blue':'gray'}">${r.channel}</span></td>
      <td>${r.product}</td>
      <td>${num(r.units)}</td>
      <td>${usd2(r.price || 0)}</td>
      <td><strong>${usd(r.revenue)}</strong></td>
      <td>${r.customer || ''}</td>
      <td>${r.orderRef || ''}</td>
      <td>${r.notes || ''}</td>
      <td><div class="row-actions"><button data-edit="sales" data-id="${r.id}">Edit</button><button class="danger" data-del="sales" data-id="${r.id}">Delete</button></div></td>
    </tr>`;
  }).join('') : `<tr><td colspan="10" class="empty">No sales in range. Click "+ Add Sale".</td></tr>`;

  // Sales summary KPIs
  const totalRev = rows.reduce((a,b)=>a+Number(b.revenue||0),0);
  const totalUnits = rows.reduce((a,b)=>a+Number(b.units||0),0);
  setText('salesTotalRev', usd(totalRev));
  setText('salesTotalOrders', num(rows.length));
  setText('salesTotalUnits', num(totalUnits));
  setText('salesAOV', usd(rows.length ? totalRev/rows.length : 0));

  const trend = groupByBucket(filteredSales(), r => r.revenue);
  drawChart('salesTrendChart', 'line', { labels: trend.map(t=>t[0]), datasets: [{ label: 'Revenue', data: trend.map(t=>t[1]), borderColor: '#7c5cff', backgroundColor: 'rgba(124,92,255,0.18)', fill:true, tension:0.35, borderWidth:2 }] });
  const chans = ['TikTok','Shopify','Other'];
  drawChart('salesChannelChart', 'bar', { labels: chans, datasets: [{ label: 'Revenue', data: chans.map(c => filteredSales().filter(r=>r.channel===c).reduce((a,b)=>a+Number(b.revenue||0),0)), backgroundColor: ['#7c5cff','#22d3ee','#34d399'], borderRadius: 8 }] });
}

function renderReturns() {
  if (!document.getElementById('view-returns')) return;
  const channelFilter = document.getElementById('returnsChannelFilter').value;
  const statusFilter = document.getElementById('returnsStatusFilter').value;
  const data = filteredReturns()
    .filter(r => !channelFilter || r.channel === channelFilter)
    .filter(r => !statusFilter || r.status === statusFilter)
    .sort((a,b) => (b.date||'').localeCompare(a.date||''));

  const all = filteredReturns();
  const totalUnits = all.reduce((a,b)=>a+Number(b.units||0),0);
  const totalRefund = all.reduce((a,b)=>a+Number(b.refundAmount||0),0);
  const tt = all.filter(r=>r.channel==='TikTok').length;
  const sp = all.filter(r=>r.channel==='Shopify').length;
  const pending = all.filter(r=>r.status==='Pending').length;
  const totalSales = filteredSales().reduce((a,b)=>a+Number(b.units||0),0) || 1;
  const refundRate = (totalUnits / totalSales) * 100;

  setText('rtUnits', num(totalUnits));
  setText('rtRefund', usd(totalRefund));
  setText('rtRate', pct(refundRate));
  setText('rtTikTok', num(tt));
  setText('rtShopify', num(sp));
  setText('rtPending', num(pending));

  const body = document.querySelector('#returnsTable tbody');
  body.innerHTML = data.length ? data.map(r => {
    const stCol = r.status==='Refunded'||r.status==='Replaced'?'green':r.status==='Pending'?'yellow':r.status==='Rejected'?'red':'blue';
    return `<tr>
      <td>${r.date}</td>
      <td><span class="pill ${r.channel==='TikTok'?'purple':r.channel==='Shopify'?'blue':'gray'}">${r.channel}</span></td>
      <td>${r.product}</td>
      <td>${num(r.units)}</td>
      <td>${usd2(r.refundAmount||0)}</td>
      <td>${r.reason || ''}</td>
      <td><span class="pill ${stCol}">${r.status || 'Pending'}</span></td>
      <td>${r.customer || ''}</td>
      <td>${r.orderRef || ''}</td>
      <td>${r.notes || ''}</td>
      <td><div class="row-actions"><button data-edit="returns" data-id="${r.id}">Edit</button><button class="danger" data-del="returns" data-id="${r.id}">Delete</button></div></td>
    </tr>`;
  }).join('') : `<tr><td colspan="11" class="empty">No return records. Click "+ Add Return Record".</td></tr>`;

  // Charts
  const labels = Array.from(new Set(all.map(r => bucketKey(r.date)))).sort();
  drawChart('returnsTrendChart', 'line', {
    labels,
    datasets: [
      { label: 'Units Returned', data: labels.map(l => all.filter(r => bucketKey(r.date)===l).reduce((a,b)=>a+Number(b.units||0),0)), borderColor: '#f87171', backgroundColor:'rgba(248,113,113,0.15)', tension:0.35, fill:true, borderWidth:2 },
      { label: 'Refund $', data: labels.map(l => all.filter(r => bucketKey(r.date)===l).reduce((a,b)=>a+Number(b.refundAmount||0),0)), borderColor: '#fbbf24', backgroundColor:'rgba(251,191,36,0.12)', tension:0.35, fill:false, borderWidth:2 }
    ]
  });

  const reasons = ['Defective','Wrong Item','Not as Described','Damaged in Shipping','Customer Changed Mind','Late Delivery','Other'];
  drawChart('returnsReasonChart', 'doughnut', {
    labels: reasons,
    datasets: [{ data: reasons.map(rs => all.filter(r=>r.reason===rs).length), backgroundColor: ['#f87171','#fbbf24','#7c5cff','#22d3ee','#34d399','#f472b6','#8b94b8'], borderWidth: 0 }]
  });
}

function renderChannel(type, prefix) {
  const data = type === 'tiktok' ? filteredTikTok() : filteredShopify();
  const sales = filteredSales().filter(r => r.channel === (type==='tiktok'?'TikTok':'Shopify'));
  setText(`${prefix}Revenue`, usd(sales.reduce((a,b)=>a+Number(b.revenue||0),0)));
  setText(`${prefix}Fulfilled`, num(data.reduce((a,b)=>a+Number(b.fulfilled||0),0)));
  setText(`${prefix}Cancel`, num(data.reduce((a,b)=>a+Number(b.cancelled||0),0)));
  setText(`${prefix}Returns`, num(data.reduce((a,b)=>a+Number(b.returns||0)+Number(b.refunded||0),0)));

  const rows = data.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const body = document.querySelector(`#${type}Table tbody`);
  body.innerHTML = rows.length ? rows.map(r => {
    const linkedTag = r._linkedSaleId ? '<span class="pill purple tiny">🔗 Linked</span> ' : '';
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
  const couponDiscount = data.filter(r => r.type === 'Coupon' || r.type === 'Discount');
  const couponRedeems = couponDiscount.reduce((a,b)=>a+Number(b.redemptions||0),0);
  const discountVal = couponDiscount.reduce((a,b)=>a+Number(b.revenue||0),0);
  setText('mkSpend', usd(totalSpend));
  setText('mkRevenue', usd(totalRev));
  setText('mkROAS', (totalSpend>0 ? (totalRev/totalSpend) : 0).toFixed(1) + '×');
  setText('mkDiscounts', usd(discountVal));
  setText('mkCouponUses', num(couponRedeems));

  const body = document.querySelector('#marketingTable tbody');
  const rows = data.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  body.innerHTML = rows.length ? rows.map(r => {
    const roas = Number(r.spend) > 0 ? (Number(r.revenue||0)/Number(r.spend)).toFixed(1) + '×' : '—';
    const tCol = { Coupon:'green', Discount:'yellow', Ads:'purple', Affiliate:'blue' }[r.type] || 'gray';
    return `<tr><td>${r.date}</td><td><span class="pill ${tCol}">${r.type}</span></td><td>${r.channel || ''}</td><td>${r.campaign || ''}</td><td>${num(r.redemptions||0)}</td><td>${usd(r.spend)}</td><td>${usd(r.revenue)}</td><td>${roas}</td><td>${r.notes || ''}</td><td><div class="row-actions"><button data-edit="marketing" data-id="${r.id}">Edit</button><button class="danger" data-del="marketing" data-id="${r.id}">Delete</button></div></td></tr>`;
  }).join('') : `<tr><td colspan="10" class="empty">No marketing entries.</td></tr>`;

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
  const rows = state.inventory.map(r => ({ ...r, _level: stockLevel(r.stock, r.reorder) }))
    .filter(r => !stockFilter || r._level.label === stockFilter)
    .filter(r => !search || (r.product+' '+r.sku).toLowerCase().includes(search));
  const body = document.querySelector('#inventoryTable tbody');
  body.innerHTML = rows.length ? rows.map(r => {
    return `<tr>
      <td><strong>${r.product}</strong></td>
      <td>${r.sku || ''}</td>
      <td>${num(r.stock)}</td>
      <td><span class="pill ${r._level.cls}">${r._level.label}</span></td>
      <td>${usd2(r.price)}</td>
      <td>${r.tiktok ? '<span class="pill purple">Live</span>' : '<span class="pill gray">—</span>'}</td>
      <td>${r.shopify ? '<span class="pill blue">Live</span>' : '<span class="pill gray">—</span>'}</td>
      <td>${r.other ? '<span class="pill green">Live</span>' : '<span class="pill gray">—</span>'}</td>
      <td>${num(r.reorder)}</td>
      <td>${r.remarks || r._level.remark}</td>
      <td><div class="row-actions"><button data-edit="inventory" data-id="${r.id}">Edit</button><button class="danger" data-del="inventory" data-id="${r.id}">Delete</button></div></td>
    </tr>`;
  }).join('') : `<tr><td colspan="11" class="empty">No products. Add one to start.</td></tr>`;

  const levels = ['Critical','Low','Healthy','Overstock'];
  drawChart('invHealthChart', 'doughnut', { labels: levels, datasets: [{ data: levels.map(l => state.inventory.filter(p => stockLevel(p.stock,p.reorder).label===l).length), backgroundColor: ['#f87171','#fbbf24','#34d399','#22d3ee'], borderWidth: 0 }] });
  drawChart('invCoverageChart', 'bar', { labels: ['TikTok','Shopify','Other'], datasets: [{ label: 'Products Listed', data: [state.inventory.filter(p=>p.tiktok).length, state.inventory.filter(p=>p.shopify).length, state.inventory.filter(p=>p.other).length], backgroundColor: ['#7c5cff','#22d3ee','#34d399'], borderRadius: 8 }] });
}

function renderCustomersAndReviews() {
  // Customer records
  const statusFilter = document.getElementById('customersStatusFilter').value;
  const search = (document.getElementById('customersSearch').value || '').toLowerCase();
  const customerRows = state.customers
    .filter(c => !statusFilter || c.status === statusFilter)
    .filter(c => !search || (`${c.name} ${c.email||''} ${c.phone||''} ${c.tags||''}`).toLowerCase().includes(search))
    .sort((a,b) => (b.lastOrder||'').localeCompare(a.lastOrder||''));

  const cBody = document.querySelector('#customersTable tbody');
  cBody.innerHTML = customerRows.length ? customerRows.map(c => {
    const sCol = c.status==='VIP'?'purple':c.status==='Active'?'green':c.status==='New'?'blue':'gray';
    return `<tr>
      <td><strong>${c.name}</strong>${c.tags ? `<br><span class="muted-tiny">${c.tags}</span>` : ''}</td>
      <td>${c.email || ''}<br><span class="muted-tiny">${c.phone || ''}</span></td>
      <td>${c.channel || ''}</td>
      <td>${num(c.totalOrders||0)}</td>
      <td>${usd(c.totalSpent||0)}</td>
      <td>${num(c.returnsCount||0)}</td>
      <td>${c.lastOrder || ''}</td>
      <td><span class="pill ${sCol}">${c.status || 'New'}</span></td>
      <td><div class="row-actions"><button data-edit="customers" data-id="${c.id}">Edit</button><button class="danger" data-del="customers" data-id="${c.id}">Delete</button></div></td>
    </tr>`;
  }).join('') : `<tr><td colspan="9" class="empty">No customer records yet. Add one or import from Excel.</td></tr>`;

  setText('cxCustomerCount', num(state.customers.length));
  setText('cxVIPCount', num(state.customers.filter(c=>c.status==='VIP').length));
  setText('cxActiveCount', num(state.customers.filter(c=>c.status==='Active').length));

  // Reviews (existing)
  const data = filteredCustomer();
  const sentFilter = document.getElementById('cxSentimentFilter').value;
  const catFilter = document.getElementById('cxCategoryFilter').value;
  const rows = data
    .filter(r => !sentFilter || r.sentiment === sentFilter)
    .filter(r => !catFilter || r.category === catFilter)
    .sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  setText('cxPositive', num(data.filter(r=>r.sentiment==='Positive').length));
  setText('cxNegative', num(data.filter(r=>r.sentiment==='Negative').length));
  const ratings = data.map(r=>Number(r.rating||0)).filter(n=>n>0);
  const avg = ratings.length ? (ratings.reduce((a,b)=>a+b,0)/ratings.length) : 0;
  setText('cxRating', avg.toFixed(1));
  const resolved = data.filter(r => r.status === 'Resolved' || r.status === 'Closed').length;
  setText('cxResolution', data.length ? Math.round((resolved/data.length)*100) + '%' : '0%');

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

// ============================================================
// IMPORT (Excel / CSV / PDF / JSON)
// ============================================================
const importModal = document.getElementById('importModal');
const importBody = document.getElementById('importBody');
let importContext = null; // { type, rows, headers }

function openImportModal() {
  importModal.classList.remove('hidden');
  renderImportStep1();
}
function closeImportModal() {
  importModal.classList.add('hidden');
  importContext = null;
}
document.getElementById('importClose').addEventListener('click', closeImportModal);
importModal.addEventListener('click', (e) => { if (e.target === importModal) closeImportModal(); });

function renderImportStep1() {
  importBody.innerHTML = `
    <div class="import-step">
      <h4>1. What are you importing?</h4>
      <div class="import-types">
        ${[
          { key: 'sales', label: 'Sales', desc: 'Sale transactions' },
          { key: 'returns', label: 'Returns & Refunds', desc: 'Return/refund records' },
          { key: 'customers', label: 'Customers', desc: 'Customer database' },
          { key: 'inventory', label: 'Inventory', desc: 'Products & stock' },
          { key: 'marketing', label: 'Marketing & Coupons', desc: 'Campaigns, coupons, ads' },
          { key: 'json', label: 'Full Backup (JSON)', desc: 'Replaces ALL data' }
        ].map(o => `<button class="import-type-btn" data-import-type="${o.key}"><strong>${o.label}</strong><span>${o.desc}</span></button>`).join('')}
      </div>
    </div>
  `;
  importBody.querySelectorAll('[data-import-type]').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.importType;
      if (type === 'json') return renderImportJSON();
      renderImportStep2(type);
    });
  });
}

function renderImportJSON() {
  importBody.innerHTML = `
    <div class="import-step">
      <h4>Restore from JSON backup</h4>
      <p class="muted">This will <strong style="color:#f87171">REPLACE all current data</strong>. Make sure to export your current data first if you need a backup.</p>
      <input type="file" id="jsonFileInput" accept=".json,application/json" />
      <div class="import-actions">
        <button class="ghost-btn" id="importBack">← Back</button>
      </div>
    </div>
  `;
  document.getElementById('importBack').addEventListener('click', renderImportStep1);
  document.getElementById('jsonFileInput').addEventListener('change', (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const obj = JSON.parse(ev.target.result);
        if (!confirm('Replace ALL cloud data with this backup?')) return;
        state = migrateData({ ...defaultData, ...obj });
        saveData(); renderAll(); closeImportModal(); showToast('Backup restored');
      } catch { showToast('Import failed — invalid JSON'); }
    };
    reader.readAsText(file);
  });
}

const expectedFields = {
  sales: ['date','channel','product','units','price','revenue','customer','orderRef','notes'],
  returns: ['date','channel','product','units','refundAmount','reason','status','customer','orderRef','notes'],
  customers: ['name','email','phone','channel','firstOrder','lastOrder','totalOrders','totalSpent','returnsCount','status','tags','notes'],
  inventory: ['product','sku','stock','reorder','price','tiktok','shopify','other','remarks'],
  marketing: ['date','type','channel','campaign','redemptions','spend','revenue','notes']
};

function renderImportStep2(type) {
  const fields = expectedFields[type];
  const templateRow = fields.join(',');
  importBody.innerHTML = `
    <div class="import-step">
      <h4>2. Upload your file (${type})</h4>
      <p class="muted">Supported: <strong>Excel</strong> (.xlsx, .xls), <strong>CSV</strong>, <strong>PDF</strong>. The first row should be headers.</p>
      <div class="import-template">
        Expected columns: <code>${fields.join(', ')}</code>
        <button class="ghost-btn" id="downloadTemplate">↓ Download CSV template</button>
      </div>
      <input type="file" id="dataFileInput" accept=".xlsx,.xls,.csv,.pdf" />
      <div id="importPreview"></div>
      <div class="import-actions">
        <button class="ghost-btn" id="importBack">← Back</button>
      </div>
    </div>
  `;
  document.getElementById('importBack').addEventListener('click', renderImportStep1);
  document.getElementById('downloadTemplate').addEventListener('click', () => {
    const blob = new Blob([templateRow + '\n'], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${type}-template.csv`; a.click();
    URL.revokeObjectURL(url);
  });
  document.getElementById('dataFileInput').addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    try {
      let rows = [];
      if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
        rows = await parseSpreadsheet(file);
      } else if (ext === 'pdf') {
        rows = await parsePDF(file);
      } else {
        showToast('Unsupported file type'); return;
      }
      if (!rows.length) { showToast('No rows found in file'); return; }
      importContext = { type, rows, headers: Object.keys(rows[0]) };
      renderImportPreview();
    } catch (err) {
      console.error(err);
      showToast('Could not parse file: ' + err.message);
    }
  });
}

function parseSpreadsheet(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target.result);
        const wb = XLSX.read(data, { type: 'array', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false, dateNF: 'yyyy-mm-dd' });
        resolve(json);
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error('Read failed'));
    reader.readAsArrayBuffer(file);
  });
}

async function parsePDF(file) {
  if (typeof pdfjsLib === 'undefined') throw new Error('PDF library not loaded');
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let lines = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const textContent = await page.getTextContent();
    // Group items by Y position to recover rows
    const byY = new Map();
    textContent.items.forEach(it => {
      const y = Math.round(it.transform[5]);
      if (!byY.has(y)) byY.set(y, []);
      byY.get(y).push({ x: it.transform[4], str: it.str });
    });
    const sorted = Array.from(byY.entries()).sort((a,b) => b[0] - a[0]);
    sorted.forEach(([_, items]) => {
      items.sort((a,b) => a.x - b.x);
      const rowText = items.map(i => i.str).join('\t').trim();
      if (rowText) lines.push(rowText);
    });
  }
  if (!lines.length) throw new Error('No text found in PDF');
  // Try to detect a header row
  const headers = lines[0].split('\t').map(s => s.trim()).filter(Boolean);
  if (headers.length < 2) throw new Error('Could not detect table headers in PDF. Try CSV/Excel export instead.');
  const rows = lines.slice(1).map(line => {
    const cells = line.split('\t').map(s => s.trim());
    const row = {};
    headers.forEach((h, i) => { row[h] = cells[i] || ''; });
    return row;
  }).filter(r => Object.values(r).some(v => v));
  return rows;
}

function renderImportPreview() {
  const { type, rows, headers } = importContext;
  const fields = expectedFields[type];
  const preview = rows.slice(0, 5);
  const previewEl = document.getElementById('importPreview');
  previewEl.innerHTML = `
    <div class="import-preview">
      <h5>Found ${rows.length} rows. Map columns:</h5>
      <div class="import-mapping">
        ${fields.map(f => `
          <label>${f}
            <select data-map-field="${f}">
              <option value="">— skip —</option>
              ${headers.map(h => {
                const isMatch = h.toLowerCase().replace(/[^a-z0-9]/g,'') === f.toLowerCase().replace(/[^a-z0-9]/g,'');
                return `<option value="${h}" ${isMatch?'selected':''}>${h}</option>`;
              }).join('')}
            </select>
          </label>
        `).join('')}
      </div>
      <h5>Preview (first 5 rows from your file):</h5>
      <div class="table-wrap">
        <table class="data-table small">
          <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
          <tbody>${preview.map(r => `<tr>${headers.map(h => `<td>${r[h] ?? ''}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </div>
      <div class="import-actions">
        <button class="ghost-btn" id="importCancel2">Cancel</button>
        <button class="primary-btn" id="confirmImport">Import ${rows.length} rows</button>
      </div>
    </div>
  `;
  document.getElementById('importCancel2').addEventListener('click', closeImportModal);
  document.getElementById('confirmImport').addEventListener('click', () => {
    const mapping = {};
    document.querySelectorAll('[data-map-field]').forEach(s => {
      if (s.value) mapping[s.dataset.mapField] = s.value;
    });
    confirmImport(type, rows, mapping);
  });
}

function confirmImport(type, rows, mapping) {
  const newRecords = rows.map(row => {
    const rec = { id: uid() };
    Object.keys(mapping).forEach(field => {
      let val = row[mapping[field]];
      if (val === undefined || val === null) val = '';
      // Coerce numbers / booleans
      if (['units','price','revenue','refundAmount','stock','reorder','spend','redemptions','totalOrders','totalSpent','returnsCount','rating','sales','fulfilled','cancelled','returns','claims','refunded','replaced','inventory'].includes(field)) {
        val = Number(String(val).replace(/[^0-9.\-]/g,'')) || 0;
      }
      if (['tiktok','shopify','other'].includes(field) && type === 'inventory') {
        val = String(val).toLowerCase();
        val = val === 'true' || val === 'yes' || val === '1' || val === 'live';
      }
      rec[field] = val;
    });
    return rec;
  });
  state[type] = state[type].concat(newRecords);

  // Auto-link sales imports to channel ops
  if (type === 'sales') {
    newRecords.forEach(r => autoLinkSaleToChannel(r));
  }

  saveData(); renderAll(); closeImportModal();
  showToast(`Imported ${newRecords.length} ${type} records`);
}

// ============================================================
// CHARTS
// ============================================================
function chartTextColor() { return getComputedStyle(document.body).getPropertyValue('--text').trim() || '#e8ecf8'; }
function chartGrid() { return (state.settings && state.settings.theme === 'light') ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'; }
function drawChart(canvasId, type, data) {
  const el = document.getElementById(canvasId);
  if (!el) return;
  if (charts[canvasId]) charts[canvasId].destroy();
  const opts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: chartTextColor(), font: { family: 'Inter', size: 11.5 } } }, tooltip: { backgroundColor: 'rgba(15,21,43,0.95)', borderColor: 'rgba(124,92,255,0.4)', borderWidth: 1 } },
    scales: (type === 'doughnut' || type === 'pie') ? {} : { x: { ticks: { color: chartTextColor() }, grid: { color: chartGrid() } }, y: { ticks: { color: chartTextColor() }, grid: { color: chartGrid() }, beginAtZero: true } }
  };
  charts[canvasId] = new Chart(el, { type, data, options: opts });
}

function renderAll() {
  if (!isReady) return;
  renderExecutive(); renderSales(); renderReturns();
  renderChannel('tiktok', 'tt'); renderChannel('shopify', 'sp');
  renderMarketing(); renderInventory(); renderCustomersAndReviews();
}

initFirebase();
