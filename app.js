// ─── DATA ───────────────────────────────────────────────────────────────────

const BRANDS = { MG: ['MG4','MG4 SE 51kWh','MG4 SE 64kWh','MG4 Urban','MG4 X-Power RS4','MG5','MG5 Trophy','MGS5 Advan','MGS5 Trophy','MGS6 Trophy','MGS6 Performance','MGZS Hybrid','MG3 MT','MG3 Hybrid','Cyberster'], GAC: ['Aion UT','Aion Y Premium','Aion V Premium','Aion V Luxury','GAC E9 PHEV','Aion ES'] };
const STATUSES = ['未出牌','已上運輸署','待出保險','已出保險','待交車','已交車'];
const STATUS_COLORS = { '未出牌':'red','已上運輸署':'orange','待出保險':'yellow','已出保險':'blue','待交車':'purple','已交車':'green' };
const INSURANCE_COS = ['中銀保險','太平保險','安盛保險','保誠保險','恒生保險','友邦保險','蘇黎世保險','其他'];
const NCD_OPTIONS = ['0%','10%','20%','30%','40%','50%','60%'];
const GAC_PACKAGES = ['基本Package','進階Package','旗艦Package','其他'];

// ─── INDEXEDDB ───────────────────────────────────────────────────────────────

let db;
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('VehicleCRM', 2); // version 2 for schema update
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
function fmtMoney(v) { if (!v && v !== 0) return '—'; return 'HK$' + Number(v).toLocaleString(); }
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
function yesno(val) { return val === true || val === 'true' || val === 'yes'; }
function yesnoBadge(val) {
  const ok = yesno(val);
  return span(`badge ${ok ? 'badge-green' : 'badge-red'}`, ok ? '✓ 是' : '✗ 否');
}

function statusBadge(status) {
  return span(`badge badge-${STATUS_COLORS[status] || 'gray'}`, status);
}

function showToast(msg) {
  const t = div('toast', msg);
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2000);
}

// ─── FORM HELPERS ────────────────────────────────────────────────────────────

function makeToggle(id, label, checked) {
  const wrap = div('toggle-wrap');
  const lbl = el('label', 'toggle-label', label);
  lbl.htmlFor = id;
  const track = div('toggle-track');
  const chk = input('toggle-input', { type: 'checkbox', id, checked: !!checked });
  chk.onchange = () => track.classList.toggle('on', chk.checked);
  if (checked) track.classList.add('on');
  const thumb = div('toggle-thumb');
  track.append(chk, thumb);
  wrap.append(lbl, track);
  return wrap;
}

function makeSelectEl(id, options, val, ph) {
  const s = el('select', 'form-input form-select');
  s.id = id;
  if (ph) {
    const def = el('option', '', ph); def.value = ''; def.disabled = true; def.selected = !val;
    s.appendChild(def);
  }
  options.forEach(o => { const opt = el('option', '', o); opt.value = o; if (o === val) opt.selected = true; s.appendChild(opt); });
  return s;
}

function textInput(id, ph, val, type='text') {
  return input('form-input', { id, type, placeholder: ph || '', value: val || '' });
}
function dateInput(id, val) {
  return input('form-input', { id, type: 'date', value: val || '' });
}
function moneyInput(id, ph, val) {
  return input('form-input', { id, type: 'number', placeholder: ph || '0', value: val || '', min: '0', step: '1' });
}

function sectionEl(label) {
  const s = div('form-section');
  s.appendChild(el('h2', 'section-label', label));
  return s;
}
function fieldEl(label, required, inputEl) {
  const f = div('field');
  const lbl = el('label', 'field-label', label + (required ? ' *' : ''));
  f.append(lbl, inputEl);
  return f;
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
  const hdr = div('header');
  const htop = div('header-top');
  const htitle = div('header-title');
  htitle.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="22" height="13" rx="2"/><path d="M16 16l2 5H6l2-5"/></svg><span>客戶跟進</span>`;
  const addBtn = btn('btn btn-primary btn-sm', '+ 新增客戶', () => setState({ view: 'form', editing: null }));
  htop.append(htitle, addBtn);

  const searchWrap = div('search-wrap');
  const searchIcon = div('search-icon');
  searchIcon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>`;
  const searchInput = input('search-input', { type: 'search', placeholder: '搜尋客戶名稱、電話、型號...', value: search });
  searchInput.oninput = e => setState({ search: e.target.value });
  searchWrap.append(searchIcon, searchInput);

  const filters = div('filters');
  ['', ...Object.keys(BRANDS)].forEach(b => {
    const fb = btn(`filter-chip${filterBrand === b ? ' active' : ''}`, b || '全部', () => setState({ filterBrand: filterBrand === b ? '' : b }));
    filters.appendChild(fb);
  });

  hdr.append(htop, searchWrap, filters);
  root.appendChild(hdr);

  const body = div('body');
  const grid = div('status-grid');
  STATUSES.forEach(s => {
    const c = STATUS_COLORS[s];
    const cell = btn(`status-cell status-bg-${c}${filterStatus === s ? ' ring' : ''}`, '', () => setState({ filterStatus: filterStatus === s ? '' : s }));
    cell.append(el('div', 'status-num', String(counts[s])), el('div', 'status-lbl', s));
    grid.appendChild(cell);
  });
  body.appendChild(grid);

  if (filterBrand || filterStatus) {
    const pills = div('active-filters');
    const fi = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    fi.setAttribute('width','14'); fi.setAttribute('height','14'); fi.setAttribute('viewBox','0 0 24 24'); fi.setAttribute('fill','none'); fi.setAttribute('stroke','currentColor'); fi.setAttribute('stroke-width','2');
    fi.innerHTML = '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>';
    pills.appendChild(fi);
    if (filterBrand) { const p = span('pill', filterBrand + ' ×'); p.onclick = () => setState({ filterBrand: '' }); pills.appendChild(p); }
    if (filterStatus) { const p = span('pill', filterStatus + ' ×'); p.onclick = () => setState({ filterStatus: '' }); pills.appendChild(p); }
    pills.appendChild(btn('clear-btn', '清除篩選', () => setState({ filterBrand: '', filterStatus: '' })));
    body.appendChild(pills);
  }

  if (filtered.length === 0) {
    const empty = div('empty');
    empty.innerHTML = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--muted-fg);margin-bottom:1rem"><rect x="1" y="3" width="22" height="13" rx="2"/><path d="M16 16l2 5H6l2-5"/></svg>`;
    empty.append(el('h3','',customers.length===0?'未有客戶記錄':'無符合條件的客戶'), el('p','empty-sub',customers.length===0?'按「新增客戶」開始建立記錄':'嘗試更改搜尋或篩選條件'));
    if (customers.length===0) empty.appendChild(btn('btn btn-primary btn-sm','+ 新增客戶',()=>setState({view:'form',editing:null})));
    body.appendChild(empty);
  } else {
    const list = div('customer-list');
    filtered.forEach(c => {
      const card = div('card customer-card');
      card.onclick = () => setState({ view: 'detail', detail: c });
      const top = div('card-top');
      const nameRow = div('name-row');
      nameRow.append(el('h3','customer-name',c.name), statusBadge(c.status));
      const meta = div('customer-meta');
      meta.appendChild(span('model-text',`${c.brand} ${c.model}`));
      if (c.phone) { const ph=span('phone-text',''); ph.innerHTML=`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8 19.79 19.79 0 01.23 2.18 2 2 0 012.18 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>${c.phone}`; meta.appendChild(ph); }
      top.append(nameRow, meta);
      if (c.notes) { const n=div('note-preview'); n.innerHTML=`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>${c.notes}`; top.appendChild(n); }
      const actions = div('card-actions');
      const delBtn = btn('icon-btn','',e=>{e.stopPropagation();if(confirm(`確定刪除「${c.name}」的記錄？`)){deleteCustomer(c.id).then(()=>loadAndRender());}});
      delBtn.innerHTML=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>`;
      const chev=div('chevron'); chev.innerHTML=`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>`;
      actions.append(delBtn, chev);
      card.append(top, actions);
      list.appendChild(card);
    });
    body.appendChild(list);
    body.appendChild(el('p','count-label',`共 ${filtered.length} 位客戶`));
  }

  root.appendChild(body);
  return root;
}

// ─── FORM ────────────────────────────────────────────────────────────────────

function renderForm() {
  const c = state.editing;
  const isEdit = !!c;
  let brand = c?.brand || '';

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

  // ── 1. 基本資料
  const basic = sectionEl('基本資料');
  basic.append(
    fieldEl('客戶名稱', true, textInput('f-name', '輸入客戶名稱', c?.name)),
    fieldEl('電話', false, textInput('f-phone', '輸入電話號碼', c?.phone, 'tel'))
  );
  body.appendChild(basic);

  // ── 2. 車輛資料
  const veh = sectionEl('車輛資料');
  const brandSel = makeSelectEl('f-brand', Object.keys(BRANDS), brand, '選擇品牌');
  const modelSel = makeSelectEl('f-model', brand ? BRANDS[brand] : [], c?.model, brand ? '選擇型號' : '請先選擇品牌');
  if (!brand) modelSel.disabled = true;
  brandSel.onchange = () => {
    brand = brandSel.value;
    while (modelSel.options.length) modelSel.remove(0);
    const def = el('option','','選擇型號'); def.value=''; def.disabled=true; def.selected=true; modelSel.appendChild(def);
    (BRANDS[brand]||[]).forEach(m=>{const o=el('option','',m);o.value=m;modelSel.appendChild(o);});
    modelSel.disabled = false;
    // Show/hide GAC package section
    const gacSec = document.getElementById('gac-section');
    if (gacSec) gacSec.style.display = brandSel.value === 'GAC' ? '' : 'none';
  };
  veh.append(fieldEl('品牌', true, brandSel), fieldEl('型號', true, modelSel));
  body.appendChild(veh);

  // ── 3. 跟進狀態
  const statusSec = sectionEl('跟進狀態');
  const statusSel = makeSelectEl('f-status', STATUSES, c?.status || '未出牌', null);
  statusSec.appendChild(fieldEl('目前狀態', false, statusSel));
  body.appendChild(statusSec);

  // ── 4. 付款資料
  const paySec = sectionEl('付款資料');
  const payGrid = div('date-grid');
  payGrid.append(
    fieldEl('細訂金額 (HK$)', false, moneyInput('f-deposit1', '例如 10000', c?.deposit1)),
    fieldEl('大訂金額 (HK$)', false, moneyInput('f-deposit2', '例如 50000', c?.deposit2))
  );
  paySec.appendChild(payGrid);
  paySec.appendChild(makeToggle('f-fullpaid', '是否已全數支付？', c?.fullPaid));
  body.appendChild(paySec);

  // ── 5. 財務貸款
  const loanSec = sectionEl('財務貸款');
  const hasLoanToggle = makeToggle('f-hasloan', '有冇財務貸款？', c?.hasLoan);
  loanSec.appendChild(hasLoanToggle);
  const loanDetail = div('conditional-block');
  loanDetail.id = 'loan-detail';
  loanDetail.style.display = yesno(c?.hasLoan) ? '' : 'none';
  loanDetail.appendChild(fieldEl('銀行名稱', false, textInput('f-bank', '例如：滙豐、中銀、恒生...', c?.bankName)));
  loanSec.appendChild(loanDetail);
  document.getElementById && setTimeout(() => {
    const chk = document.getElementById('f-hasloan');
    if (chk) chk.addEventListener('change', () => {
      document.getElementById('loan-detail').style.display = chk.checked ? '' : 'none';
    });
  }, 0);
  body.appendChild(loanSec);

  // ── 6. 保險
  const insSec = sectionEl('保險');
  const insTypeWrap = div('radio-group');
  ['自來保險','公司保險'].forEach(t => {
    const row = div('radio-row');
    const radio = input('', { type: 'radio', name: 'ins-type', id: `ins-${t}`, value: t });
    if ((c?.insuranceType || '自來保險') === t) radio.checked = true;
    const lbl = el('label', 'radio-label', t); lbl.htmlFor = `ins-${t}`;
    row.append(radio, lbl);
    insTypeWrap.appendChild(row);
  });
  insSec.appendChild(fieldEl('保險類型', false, insTypeWrap));

  const selfInsDetail = div('conditional-block');
  selfInsDetail.id = 'self-ins-detail';
  selfInsDetail.style.display = (c?.insuranceType === '公司保險') ? 'none' : '';
  selfInsDetail.append(
    fieldEl('保險公司', false, makeSelectEl('f-ins-company', INSURANCE_COS, c?.insuranceCompany, '選擇保險公司')),
    fieldEl('NCD', false, makeSelectEl('f-ncd', NCD_OPTIONS, c?.ncd, '選擇NCD'))
  );
  insSec.appendChild(selfInsDetail);

  // radio change handler
  setTimeout(() => {
    document.querySelectorAll('input[name="ins-type"]').forEach(r => {
      r.addEventListener('change', () => {
        const detail = document.getElementById('self-ins-detail');
        if (detail) detail.style.display = r.value === '自來保險' ? '' : 'none';
      });
    });
  }, 0);
  body.appendChild(insSec);

  // ── 7. GAC Package（只有GAC先顯示）
  const gacSec = sectionEl('GAC Package');
  gacSec.id = 'gac-section';
  gacSec.style.display = brand === 'GAC' ? '' : 'none';
  const hasPackageToggle = makeToggle('f-haspackage', '有冇購買Package？', c?.hasPackage);
  gacSec.appendChild(hasPackageToggle);
  const pkgDetail = div('conditional-block');
  pkgDetail.id = 'pkg-detail';
  pkgDetail.style.display = yesno(c?.hasPackage) ? '' : 'none';
  pkgDetail.append(
    fieldEl('Package名稱', false, makeSelectEl('f-package', GAC_PACKAGES, c?.packageName, '選擇Package')),
    makeToggle('f-pkgpaid', '是否已付Package款項？', c?.packagePaid)
  );
  gacSec.appendChild(pkgDetail);
  setTimeout(() => {
    const chk = document.getElementById('f-haspackage');
    if (chk) chk.addEventListener('change', () => {
      document.getElementById('pkg-detail').style.display = chk.checked ? '' : 'none';
    });
  }, 0);
  body.appendChild(gacSec);

  // ── 8. 運輸署手續
  const tdSec = sectionEl('運輸署手續');
  const hasExtraToggle = makeToggle('f-extratd', '有冇額外運輸署手續辦理？', c?.extraTransport);
  tdSec.appendChild(hasExtraToggle);
  const tdDetail = div('conditional-block');
  tdDetail.id = 'td-detail';
  tdDetail.style.display = yesno(c?.extraTransport) ? '' : 'none';
  tdDetail.appendChild(fieldEl('詳細說明', false, textInput('f-tdnotes', '例如：過戶、更改車主...', c?.transportNotes)));
  tdSec.appendChild(tdDetail);
  setTimeout(() => {
    const chk = document.getElementById('f-extratd');
    if (chk) chk.addEventListener('change', () => {
      document.getElementById('td-detail').style.display = chk.checked ? '' : 'none';
    });
  }, 0);
  body.appendChild(tdSec);

  // ── 9. 其他配備
  const accSec = sectionEl('其他配備');
  const hasAccToggle = makeToggle('f-hasacc', '有冇其他配備需要加？', c?.hasAccessories);
  accSec.appendChild(hasAccToggle);
  const accDetail = div('conditional-block');
  accDetail.id = 'acc-detail';
  accDetail.style.display = yesno(c?.hasAccessories) ? '' : 'none';
  const accTA = el('textarea', 'form-input form-textarea');
  accTA.id = 'f-accessories'; accTA.placeholder = '例如：Dashcam、Tint、泊車感應器...'; accTA.rows = 3;
  if (c?.accessories) accTA.value = c.accessories;
  accDetail.appendChild(accTA);
  accSec.appendChild(accDetail);
  setTimeout(() => {
    const chk = document.getElementById('f-hasacc');
    if (chk) chk.addEventListener('change', () => {
      document.getElementById('acc-detail').style.display = chk.checked ? '' : 'none';
    });
  }, 0);
  body.appendChild(accSec);

  // ── 10. 重要日期
  const dateSec = sectionEl('重要日期');
  const dg = div('date-grid');
  dg.append(
    fieldEl('上Office日期', false, dateInput('f-office', c?.officeDate)),
    fieldEl('入運輸署日期', false, dateInput('f-transport', c?.transportDate)),
    fieldEl('保險生效日期', false, dateInput('f-insurance', c?.insuranceDate)),
    fieldEl('交車日期', false, dateInput('f-delivery', c?.deliveryDate))
  );
  dateSec.appendChild(dg);
  body.appendChild(dateSec);

  // ── 11. 備註
  const noteSec = sectionEl('備註');
  const noteTA = el('textarea', 'form-input form-textarea');
  noteTA.id = 'f-notes'; noteTA.placeholder = '輸入備註...'; noteTA.rows = 3;
  if (c?.notes) noteTA.value = c.notes;
  noteSec.appendChild(noteTA);
  body.appendChild(noteSec);

  body.appendChild(div('spacer'));
  root.appendChild(body);

  // ── SAVE HANDLER
  async function handleSave() {
    const name = document.getElementById('f-name')?.value?.trim();
    const brand = document.getElementById('f-brand')?.value;
    const model = document.getElementById('f-model')?.value;
    if (!name) { showToast('⚠️ 請輸入客戶名稱'); return; }
    if (!brand) { showToast('⚠️ 請選擇品牌'); return; }
    if (!model) { showToast('⚠️ 請選擇型號'); return; }

    const insType = document.querySelector('input[name="ins-type"]:checked')?.value || '自來保險';

    const data = {
      name,
      phone: document.getElementById('f-phone')?.value?.trim() || '',
      brand, model,
      status: document.getElementById('f-status')?.value || '未出牌',
      // Payment
      deposit1: document.getElementById('f-deposit1')?.value || '',
      deposit2: document.getElementById('f-deposit2')?.value || '',
      fullPaid: document.getElementById('f-fullpaid')?.checked || false,
      // Loan
      hasLoan: document.getElementById('f-hasloan')?.checked || false,
      bankName: document.getElementById('f-bank')?.value?.trim() || '',
      // Insurance
      insuranceType: insType,
      insuranceCompany: insType === '自來保險' ? (document.getElementById('f-ins-company')?.value || '') : '',
      ncd: insType === '自來保險' ? (document.getElementById('f-ncd')?.value || '') : '',
      // GAC Package
      hasPackage: document.getElementById('f-haspackage')?.checked || false,
      packageName: document.getElementById('f-package')?.value || '',
      packagePaid: document.getElementById('f-pkgpaid')?.checked || false,
      // Transport
      extraTransport: document.getElementById('f-extratd')?.checked || false,
      transportNotes: document.getElementById('f-tdnotes')?.value?.trim() || '',
      // Accessories
      hasAccessories: document.getElementById('f-hasacc')?.checked || false,
      accessories: document.getElementById('f-accessories')?.value?.trim() || '',
      // Dates
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

// ─── DETAIL ──────────────────────────────────────────────────────────────────

function detailRow(icon, label, val, isVal=true) {
  const row = div('date-row');
  const left = div('date-left');
  left.append(span('date-icon', icon), span('date-label', label));
  const right = isVal
    ? span(`date-val${val ? '' : ' empty'}`, val || '—')
    : val;
  row.append(left, right);
  return row;
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

  // Top row
  const topRow = div('detail-top-row');
  topRow.append(statusBadge(c.status), span('brand-model-text', `${c.brand} · ${c.model}`));
  body.appendChild(topRow);

  // Phone
  if (c.phone) {
    const pc = div('card phone-card');
    const ph = div('phone-left');
    ph.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8 19.79 19.79 0 01.23 2.18 2 2 0 012.18 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg><span>${c.phone}</span>`;
    const callLink = el('a', 'call-link', '致電');
    callLink.href = `tel:${c.phone}`; callLink.target = '_blank';
    pc.append(ph, callLink);
    body.appendChild(pc);
  }

  // Pipeline
  const pipeline = div('card');
  pipeline.appendChild(el('h3', 'card-title', '跟進流程'));
  const steps = div('pipeline');
  STATUSES.forEach((s, i) => {
    const done = i < cidx, cur = i === cidx;
    const step = div(`step${done?' done':cur?' current':' pending'}`);
    const iw = div('step-icon-wrap');
    if (done) iw.innerHTML=`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="8 12 11 15 16 9"/></svg>`;
    else if (cur) iw.innerHTML=`<div class="step-dot-outer"><div class="step-dot-inner"></div></div>`;
    else iw.innerHTML=`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/></svg>`;
    if (i < STATUSES.length-1) iw.appendChild(div(`step-line${done?' line-done':''}`));
    step.append(iw, span('step-label', s));
    steps.appendChild(step);
  });
  pipeline.appendChild(steps);
  body.appendChild(pipeline);

  // Payment
  const payCard = div('card');
  payCard.appendChild(el('h3', 'card-title', '💳 付款資料'));
  const payList = div('date-list');
  payList.append(
    detailRow('🔹', '細訂金額', fmtMoney(c.deposit1)),
    detailRow('🔷', '大訂金額', fmtMoney(c.deposit2)),
    detailRow('✅', '已全數支付', null, false)
  );
  // replace last row's right
  const payRows = payList.querySelectorAll ? null : null;
  // rebuild last row properly
  payList.innerHTML = '';
  payList.appendChild(detailRow('🔹', '細訂金額', fmtMoney(c.deposit1)));
  payList.appendChild(detailRow('🔷', '大訂金額', fmtMoney(c.deposit2)));
  const fullPaidRow = div('date-row');
  const fpLeft = div('date-left'); fpLeft.append(span('date-icon','✅'), span('date-label','已全數支付'));
  fullPaidRow.append(fpLeft, yesnoBadge(c.fullPaid));
  payList.appendChild(fullPaidRow);
  payCard.appendChild(payList);
  body.appendChild(payCard);

  // Loan
  const loanCard = div('card');
  loanCard.appendChild(el('h3', 'card-title', '🏦 財務貸款'));
  const loanList = div('date-list');
  const loanRow = div('date-row');
  const llLeft = div('date-left'); llLeft.append(span('date-icon','🏦'), span('date-label','有冇貸款'));
  loanRow.append(llLeft, yesnoBadge(c.hasLoan));
  loanList.appendChild(loanRow);
  if (yesno(c.hasLoan) && c.bankName) {
    loanList.appendChild(detailRow('🏛️', '銀行名稱', c.bankName));
  }
  loanCard.appendChild(loanList);
  body.appendChild(loanCard);

  // Insurance
  const insCard = div('card');
  insCard.appendChild(el('h3', 'card-title', '🛡️ 保險'));
  const insList = div('date-list');
  insList.appendChild(detailRow('📋', '保險類型', c.insuranceType || '自來保險'));
  if ((c.insuranceType || '自來保險') === '自來保險') {
    if (c.insuranceCompany) insList.appendChild(detailRow('🏢', '保險公司', c.insuranceCompany));
    if (c.ncd) insList.appendChild(detailRow('💯', 'NCD', c.ncd));
  }
  insCard.appendChild(insList);
  body.appendChild(insCard);

  // GAC Package (only show if GAC)
  if (c.brand === 'GAC') {
    const pkgCard = div('card');
    pkgCard.appendChild(el('h3', 'card-title', '📦 GAC Package'));
    const pkgList = div('date-list');
    const pkgRow = div('date-row');
    const pkLeft = div('date-left'); pkLeft.append(span('date-icon','📦'), span('date-label','購買Package'));
    pkgRow.append(pkLeft, yesnoBadge(c.hasPackage));
    pkgList.appendChild(pkgRow);
    if (yesno(c.hasPackage)) {
      if (c.packageName) pkgList.appendChild(detailRow('🏷️', 'Package名稱', c.packageName));
      const paidRow = div('date-row');
      const ppLeft = div('date-left'); ppLeft.append(span('date-icon','💰'), span('date-label','已付款'));
      paidRow.append(ppLeft, yesnoBadge(c.packagePaid));
      pkgList.appendChild(paidRow);
    }
    pkgCard.appendChild(pkgList);
    body.appendChild(pkgCard);
  }

  // Extra Transport
  const tdCard = div('card');
  tdCard.appendChild(el('h3', 'card-title', '🏛️ 運輸署手續'));
  const tdList = div('date-list');
  const tdRow = div('date-row');
  const tdLeft = div('date-left'); tdLeft.append(span('date-icon','📝'), span('date-label','額外手續'));
  tdRow.append(tdLeft, yesnoBadge(c.extraTransport));
  tdList.appendChild(tdRow);
  if (yesno(c.extraTransport) && c.transportNotes) {
    tdList.appendChild(detailRow('📋', '詳細', c.transportNotes));
  }
  tdCard.appendChild(tdList);
  body.appendChild(tdCard);

  // Accessories
  if (yesno(c.hasAccessories) && c.accessories) {
    const accCard = div('card');
    accCard.append(el('h3','card-title','🔧 其他配備'), el('p','note-body', c.accessories));
    body.appendChild(accCard);
  }

  // Dates
  const dateCard = div('card');
  dateCard.appendChild(el('h3', 'card-title', '📅 重要日期'));
  const dateList = div('date-list');
  [['📋','上Office日期',c.officeDate],['🏛️','入運輸署日期',c.transportDate],['🛡️','保險生效日期',c.insuranceDate],['🚗','交車日期',c.deliveryDate]]
    .forEach(([icon,label,val]) => dateList.appendChild(detailRow(icon, label, fmtDate(val))));
  dateCard.appendChild(dateList);
  body.appendChild(dateCard);

  // Notes
  if (c.notes) {
    const noteCard = div('card');
    noteCard.append(el('h3','card-title','備註'), el('p','note-body',c.notes));
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
  if (state.detail) {
    const fresh = state.customers.find(c => c.id === state.detail.id);
    state.detail = fresh || null;
    if (!fresh) state.view = 'list';
  }
  render();
}

openDB().then(loadAndRender).catch(err => {
  document.getElementById('app').innerHTML = `<div style="padding:2rem;color:red">無法開啟本地數據庫：${err.message}</div>`;
});
