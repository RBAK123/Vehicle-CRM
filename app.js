// ─── DATA ───────────────────────────────────────────────────────────────────

const BRANDS = { MG: ['MG4','MG5','MGS5 Advan','MGS5 Trophy','MGS6 Trophy','MGS6 Performance','MGZS Hybrid','MG3 MT','MG3 Hybrid','Cyberster','MG M9 Premium','MG M9 Luxury'], GAC: ['Aion UT','Aion Y Premium','Aion V Premium','Aion V Luxury','GAC E9 PHEV','Aion ES'] };
const STATUSES = ['未出牌','已上運輸署','待出保險','已出保險','待交車','已交車'];
const STATUS_COLORS = { '未出牌':'red','已上運輸署':'orange','待出保險':'yellow','已出保險':'blue','待交車':'purple','已交車':'green' };

// ─── INDEXEDDB ───────────────────────────────────────────────────────────────

let db;
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('VehicleCRM', 1);
    req.onupgradeneeded = e => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains('customers')) {
        const store = d.createObjectStore('customers', { keyPath: 'id', autoIncrement: true });
        store.createIndex('brand', 'brand', { unique: false });
        store.createIndex('status', 'status', { unique: false });
      }
    };
    req.onsuccess = e => { db = e.target.result; resolve(db); };
    req.onerror = () => reject(req.error);
  });
}
function tx(mode) { return db.transaction('customers', mode).objectStore('customers'); }
function getAllCustomers() { return new Promise((res, rej) => { const r = tx('readonly').getAll(); r.onsuccess = () => res(r.result.reverse()); r.onerror = () => rej(r.error); }); }
function addCustomer(data) { return new Promise((res, rej) => { const r = tx('readwrite').add(data); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
function updateCustomer(data) { return new Promise((res, rej) => { const r = tx('readwrite').put(data); r.onsuccess = () => res(); r.onerror = () => rej(r.error); }); }
function deleteCustomer(id) { return new Promise((res, rej) => { const r = tx('readwrite').delete(id); r.onsuccess = () => res(); r.onerror = () => rej(r.error); }); }

// ─── STATE ───────────────────────────────────────────────────────────────────

let state = { view: 'list', customers: [], search: '', filterBrand: '', filterStatus: '', editing: null, detail: null };
function setState(patch) { Object.assign(state, patch); render(); }

// ─── UTILS ───────────────────────────────────────────────────────────────────

function fmtDate(d) { if (!d) return '—'; try { return d.replace(/-/g, '/'); } catch { return d; } }
function el(tag, cls, ...children) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  children.forEach(c => { if (c == null) return; e.append(typeof c === 'string' ? document.createTextNode(c) : c); });
  return e;
}
function div(cls, ...c) { return el('div', cls, ...c); }
function span(cls, t) { return el('span', cls, t); }
function btn(cls, text, onClick) { const b = el('button', cls, text); b.onclick = onClick; return b; }
function input(cls, attrs) { const i = el('input', cls); Object.assign(i, attrs); return i; }

function statusBadge(status) {
  const c = STATUS_COLORS[status] || 'gray';
  const badge = span(`badge badge-${c}`, status);
  return badge;
}

function showToast(msg) {
  const t = div('toast', msg);
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2000);
}

// ─── VIEWS ───────────────────────────────────────────────────────────────────

function renderList() {
  const { customers, search, filterBrand, filterStatus } = state;
  const filtered = customers.filter(c => {
    const q = search.toLowerCase();
    const ms = !search || c.name.toLowerCase().includes(q) || (c.phone||'').includes(q) || c.model.toLowerCase().includes(q);
    const mb = !filterBrand || c.brand === filterBrand;
    const mst = !filterStatus || c.status === filterStatus;
    return ms && mb && mst;
  });

  const counts = {};
  STATUSES.forEach(s => counts[s] = 0);
  customers.forEach(c => { if (counts[c.status] !== undefined) counts[c.status]++; });

  const root = div('page');

  // Header
  const hdr = div('header');
  const htop = div('header-top');
  const htitle = div('header-title');
  htitle.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="22" height="13" rx="2"/><path d="M16 16l2 5H6l2-5"/></svg><span>客戶跟進</span>`;
  const addBtn = btn('btn btn-primary btn-sm', '+ 新增客戶', () => setState({ view: 'form', editing: null }));
  htop.append(htitle, addBtn);

  // Search
  const searchWrap = div('search-wrap');
  const searchIcon = div('search-icon');
  searchIcon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>`;
  const searchInput = input('search-input', { type: 'search', placeholder: '搜尋客戶名稱、電話、型號...', value: search });
  searchInput.oninput = e => setState({ search: e.target.value });
  searchWrap.append(searchIcon, searchInput);

  // Brand filters
  const filters = div('filters');
  ['', ...Object.keys(BRANDS)].forEach(b => {
    const fb = btn(`filter-chip${filterBrand === b ? ' active' : ''}`, b || '全部', () => setState({ filterBrand: filterBrand === b ? '' : b }));
    filters.appendChild(fb);
  });

  hdr.append(htop, searchWrap, filters);
  root.appendChild(hdr);

  // Body
  const body = div('body');

  // Status grid
  const grid = div('status-grid');
  STATUSES.forEach(s => {
    const c = STATUS_COLORS[s];
    const cell = btn(`status-cell status-bg-${c}${filterStatus === s ? ' ring' : ''}`, '', () => setState({ filterStatus: filterStatus === s ? '' : s }));
    const num = el('div', 'status-num', String(counts[s]));
    const lbl = el('div', 'status-lbl', s);
    cell.append(num, lbl);
    grid.appendChild(cell);
  });
  body.appendChild(grid);

  // Active filter pills
  if (filterBrand || filterStatus) {
    const pills = div('active-filters');
    const filterIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    filterIcon.setAttribute('width', '14'); filterIcon.setAttribute('height', '14');
    filterIcon.setAttribute('viewBox', '0 0 24 24'); filterIcon.setAttribute('fill', 'none');
    filterIcon.setAttribute('stroke', 'currentColor'); filterIcon.setAttribute('stroke-width', '2');
    filterIcon.innerHTML = '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>';
    pills.appendChild(filterIcon);
    if (filterBrand) { const p = span('pill', filterBrand + ' ×'); p.onclick = () => setState({ filterBrand: '' }); pills.appendChild(p); }
    if (filterStatus) { const p = span('pill', filterStatus + ' ×'); p.onclick = () => setState({ filterStatus: '' }); pills.appendChild(p); }
    const clr = btn('clear-btn', '清除篩選', () => setState({ filterBrand: '', filterStatus: '' }));
    pills.appendChild(clr);
    body.appendChild(pills);
  }

  // Customer list
  if (filtered.length === 0) {
    const empty = div('empty');
    empty.innerHTML = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--muted-fg);margin-bottom:1rem"><rect x="1" y="3" width="22" height="13" rx="2"/><path d="M16 16l2 5H6l2-5"/></svg>`;
    const h3 = el('h3', '', customers.length === 0 ? '未有客戶記錄' : '無符合條件的客戶');
    const p = el('p', 'empty-sub', customers.length === 0 ? '按「新增客戶」開始建立記錄' : '嘗試更改搜尋或篩選條件');
    empty.append(h3, p);
    if (customers.length === 0) {
      const b = btn('btn btn-primary btn-sm', '+ 新增客戶', () => setState({ view: 'form', editing: null }));
      empty.appendChild(b);
    }
    body.appendChild(empty);
  } else {
    const list = div('customer-list');
    filtered.forEach(c => {
      const card = div('card customer-card');
      card.onclick = () => setState({ view: 'detail', detail: c });

      const top = div('card-top');
      const nameRow = div('name-row');
      const name = el('h3', 'customer-name', c.name);
      nameRow.append(name, statusBadge(c.status));
      const meta = div('customer-meta');
      const modelSpan = span('model-text', `${c.brand} ${c.model}`);
      meta.appendChild(modelSpan);
      if (c.phone) {
        const ph = span('phone-text', '');
        ph.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8 19.79 19.79 0 01.23 2.18 2 2 0 012.18 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>${c.phone}`;
        meta.appendChild(ph);
      }
      top.append(nameRow, meta);

      if (c.notes) {
        const note = div('note-preview');
        note.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>${c.notes}`;
        top.appendChild(note);
      }

      const actions = div('card-actions');
      const delBtn = btn('icon-btn', '', e => {
        e.stopPropagation();
        if (confirm(`確定刪除「${c.name}」的記錄？`)) {
          deleteCustomer(c.id).then(() => loadAndRender());
        }
      });
      delBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>`;
      const chevron = div('chevron');
      chevron.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>`;
      actions.append(delBtn, chevron);

      card.append(top, actions);
      list.appendChild(card);
    });
    body.appendChild(list);
    const count = el('p', 'count-label', `共 ${filtered.length} 位客戶`);
    body.appendChild(count);
  }

  root.appendChild(body);
  return root;
}

function renderForm() {
  const c = state.editing;
  const isEdit = !!c;
  let brand = c?.brand || '';
  let selModel = c?.model || '';

  const root = div('page');

  const hdr = div('header');
  const htop = div('header-top');
  const backBtn = btn('icon-btn-lg', '', () => setState({ view: isEdit ? 'detail' : 'list', editing: null }));
  backBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>`;
  const title = el('h1', 'page-title', isEdit ? '編輯客戶' : '新增客戶');
  const saveBtn = btn('btn btn-primary btn-sm', '💾 儲存', handleSave);
  htop.append(backBtn, title, saveBtn);
  hdr.appendChild(htop);
  root.appendChild(hdr);

  const body = div('body form-body');

  function section(label) {
    const s = div('form-section');
    const h = el('h2', 'section-label', label);
    s.appendChild(h);
    return s;
  }
  function field(label, required, inputEl) {
    const f = div('field');
    const lbl = el('label', 'field-label', label + (required ? ' *' : ''));
    if (required) { const star = span('required', ''); lbl.appendChild(star); }
    f.append(lbl, inputEl);
    return f;
  }
  function textInput(id, ph, val, type='text') {
    const i = input('form-input', { id, type, placeholder: ph, value: val || '' });
    return i;
  }
  function dateInput(id, val) {
    const i = input('form-input', { id, type: 'date', value: val || '' });
    return i;
  }
  function makeSelect(id, options, val, ph) {
    const s = el('select', 'form-input form-select');
    s.id = id;
    const def = el('option', '', ph);
    def.value = ''; def.disabled = true; def.selected = !val;
    s.appendChild(def);
    options.forEach(o => { const opt = el('option', '', o); opt.value = o; if (o === val) opt.selected = true; s.appendChild(opt); });
    return s;
  }

  // Basic
  const basic = section('基本資料');
  const nameInput = textInput('f-name', '輸入客戶名稱', c?.name);
  const phoneInput = textInput('f-phone', '輸入電話號碼', c?.phone, 'tel');
  basic.append(field('客戶名稱', true, nameInput), field('電話', false, phoneInput));
  body.appendChild(basic);

  // Vehicle
  const veh = section('車輛資料');
  const brandSel = makeSelect('f-brand', Object.keys(BRANDS), brand, '選擇品牌');
  const modelSel = makeSelect('f-model', brand ? BRANDS[brand] : [], selModel, brand ? '選擇型號' : '請先選擇品牌');
  if (!brand) modelSel.disabled = true;

  brandSel.onchange = () => {
    brand = brandSel.value;
    selModel = '';
    // rebuild model options
    while (modelSel.options.length > 0) modelSel.remove(0);
    const def = el('option', '', '選擇型號'); def.value = ''; def.disabled = true; def.selected = true;
    modelSel.appendChild(def);
    (BRANDS[brand] || []).forEach(m => { const o = el('option', '', m); o.value = m; modelSel.appendChild(o); });
    modelSel.disabled = false;
  };
  veh.append(field('品牌', true, brandSel), field('型號', true, modelSel));
  body.appendChild(veh);

  // Status
  const statusSec = section('跟進狀態');
  const statusSel = makeSelect('f-status', STATUSES, c?.status || '未出牌', '');
  if (!c?.status) { statusSel.options[0].selected = false; statusSel.value = '未出牌'; }
  statusSec.append(field('目前狀態', false, statusSel));
  body.appendChild(statusSec);

  // Dates
  const dateSec = section('重要日期');
  const dateGrid = div('date-grid');
  dateGrid.append(
    field('上Office日期', false, dateInput('f-office', c?.officeDate)),
    field('入運輸署日期', false, dateInput('f-transport', c?.transportDate)),
    field('保險生效日期', false, dateInput('f-insurance', c?.insuranceDate)),
    field('交車日期', false, dateInput('f-delivery', c?.deliveryDate))
  );
  dateSec.appendChild(dateGrid);
  body.appendChild(dateSec);

  // Notes
  const noteSec = section('備註');
  const noteTA = el('textarea', 'form-input form-textarea');
  noteTA.id = 'f-notes'; noteTA.placeholder = '輸入備註...'; noteTA.rows = 3;
  if (c?.notes) noteTA.value = c.notes;
  noteSec.appendChild(noteTA);
  body.appendChild(noteSec);

  body.appendChild(div('spacer'));
  root.appendChild(body);

  async function handleSave() {
    const name = document.getElementById('f-name')?.value?.trim();
    const brand = document.getElementById('f-brand')?.value;
    const model = document.getElementById('f-model')?.value;
    if (!name) { showToast('⚠️ 請輸入客戶名稱'); return; }
    if (!brand) { showToast('⚠️ 請選擇品牌'); return; }
    if (!model) { showToast('⚠️ 請選擇型號'); return; }
    const data = {
      name,
      phone: document.getElementById('f-phone')?.value?.trim() || '',
      brand,
      model,
      status: document.getElementById('f-status')?.value || '未出牌',
      officeDate: document.getElementById('f-office')?.value || '',
      transportDate: document.getElementById('f-transport')?.value || '',
      insuranceDate: document.getElementById('f-insurance')?.value || '',
      deliveryDate: document.getElementById('f-delivery')?.value || '',
      notes: document.getElementById('f-notes')?.value?.trim() || '',
    };
    if (isEdit) { data.id = c.id; await updateCustomer(data); showToast('✓ 已更新客戶資料'); }
    else { await addCustomer(data); showToast('✓ 已新增客戶'); }
    await loadAndRender();
    setState({ view: 'list' });
  }

  return root;
}

function renderDetail() {
  const c = state.detail;
  if (!c) { setState({ view: 'list' }); return div(''); }

  const cidx = STATUSES.indexOf(c.status);
  const root = div('page');

  const hdr = div('header');
  const htop = div('header-top');
  const backBtn = btn('icon-btn-lg', '', () => setState({ view: 'list', detail: null }));
  backBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>`;
  const title = el('h1', 'page-title detail-title', c.name);
  const editBtn = btn('btn btn-secondary btn-sm', '✏️ 編輯', () => setState({ view: 'form', editing: c }));
  htop.append(backBtn, title, editBtn);
  hdr.appendChild(htop);
  root.appendChild(hdr);

  const body = div('body');

  // Status + brand
  const topRow = div('detail-top-row');
  topRow.append(statusBadge(c.status), span('brand-model-text', `${c.brand} · ${c.model}`));
  body.appendChild(topRow);

  // Phone card
  if (c.phone) {
    const pc = div('card phone-card');
    const ph = div('phone-left');
    ph.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8 19.79 19.79 0 01.23 2.18 2 2 0 012.18 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg><span>${c.phone}</span>`;
    const callLink = el('a', 'call-link', '致電');
    callLink.href = `tel:${c.phone}`; callLink.target = '_blank'; callLink.rel = 'noopener noreferrer';
    pc.append(ph, callLink);
    body.appendChild(pc);
  }

  // Pipeline
  const pipeline = div('card');
  const ph3 = el('h3', 'card-title', '跟進流程');
  pipeline.appendChild(ph3);
  const steps = div('pipeline');
  STATUSES.forEach((s, i) => {
    const done = i < cidx, cur = i === cidx;
    const step = div(`step${done ? ' done' : cur ? ' current' : ' pending'}`);
    const iconWrap = div('step-icon-wrap');
    if (done) {
      iconWrap.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="8 12 11 15 16 9"/></svg>`;
    } else if (cur) {
      iconWrap.innerHTML = `<div class="step-dot-outer"><div class="step-dot-inner"></div></div>`;
    } else {
      iconWrap.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/></svg>`;
    }
    if (i < STATUSES.length - 1) {
      const line = div(`step-line${done ? ' line-done' : ''}`);
      iconWrap.appendChild(line);
    }
    const lbl = span('step-label', s);
    step.append(iconWrap, lbl);
    steps.appendChild(step);
  });
  pipeline.appendChild(steps);
  body.appendChild(pipeline);

  // Dates
  const dateCard = div('card');
  const dh3 = el('h3', 'card-title', '重要日期');
  dateCard.appendChild(dh3);
  const dateList = div('date-list');
  [['📋','上Office日期', c.officeDate],['🏛️','入運輸署日期', c.transportDate],['🛡️','保險生效日期', c.insuranceDate],['🚗','交車日期', c.deliveryDate]]
    .forEach(([icon, label, val]) => {
      const row = div('date-row');
      const left = div('date-left');
      left.append(span('date-icon', icon), span('date-label', label));
      const right = span(`date-val${val ? '' : ' empty'}`, fmtDate(val));
      row.append(left, right);
      dateList.appendChild(row);
    });
  dateCard.appendChild(dateList);
  body.appendChild(dateCard);

  // Notes
  if (c.notes) {
    const noteCard = div('card');
    noteCard.append(el('h3', 'card-title', '備註'), el('p', 'note-body', c.notes));
    body.appendChild(noteCard);
  }

  body.appendChild(div('spacer'));
  root.appendChild(body);
  return root;
}

// ─── RENDER ENGINE ──────────────────────────────────────────────────────────

function render() {
  const app = document.getElementById('app');
  app.innerHTML = '';
  let view;
  if (state.view === 'form') view = renderForm();
  else if (state.view === 'detail') view = renderDetail();
  else view = renderList();
  app.appendChild(view);
  window.scrollTo(0, 0);
}

async function loadAndRender() {
  state.customers = await getAllCustomers();
  // refresh detail if open
  if (state.detail) {
    const fresh = state.customers.find(c => c.id === state.detail.id);
    state.detail = fresh || null;
    if (!fresh) state.view = 'list';
  }
  render();
}

// ─── BOOT ────────────────────────────────────────────────────────────────────

openDB().then(loadAndRender).catch(err => {
  document.getElementById('app').innerHTML = `<div style="padding:2rem;color:red">無法開啟本地數據庫：${err.message}</div>`;
});
