// UI plumbing: icons, router, delegated events, sheets, toast.
const ICONS = {
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.6a3.5 3.5 0 010 6.8M18 14.6c2.2.7 3.5 2.6 3.5 5.4"/>',
  list: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6"/>',
  timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 2M9.5 2.5h5"/>',
  metro: '<path d="M8.5 21h7L13.6 4h-3.2z"/><path d="M12 16.5l4-8M10.5 4l.6-1.5"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', left: '<path d="M15 5l-7 7 7 7"/>',
  up: '<path d="M12 19V6M6 11.5l6-6 6 6"/>', down: '<path d="M12 5v13M6 12.5l6 6 6-6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>', edit: '<path d="M4 20l4-1 11-11-3-3L5 16z"/>',
  play: '<path d="M7 4.5v15l13-7.5z" fill="currentColor"/>', pause: '<path d="M8 5v14M16 5v14"/>',
  next: '<path d="M5 5l10 7-10 7zM19 5v14"/>', prev: '<path d="M19 5L9 12l10 7zM5 5v14"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/>',
};
const icon = (n, c = '') => `<svg class="i ${c}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;

// Handler tables: click (data-a), change (data-c), input (data-i), submit (data-f).
const A = {}, C = {}, I = {}, F = {}, V = {};
const ui = {};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]');
  if (!el) return;
  const h = A[el.dataset.a];
  if (h) { if (el.tagName !== 'A') e.preventDefault(); h(el.dataset, el, e); }
});
document.addEventListener('change', e => {
  const el = e.target.closest('[data-c]');
  const h = el && C[el.dataset.c];
  if (h) h(el.type === 'checkbox' ? el.checked : el.value, el.dataset, el);
});
document.addEventListener('input', e => {
  const el = e.target.closest('[data-i]');
  const h = el && I[el.dataset.i];
  if (h) h(el.value, el.dataset, el);
});
document.addEventListener('submit', e => {
  const f = e.target.closest('[data-f]');
  if (!f) return;
  e.preventDefault();
  const h = F[f.dataset.f];
  if (h) h(new FormData(f), f.dataset, f);
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

// ---------- router ----------
let leaveFns = [];
const onLeave = fn => leaveFns.push(fn);
const navigate = p => { location.hash = '#' + p; };
function parseRoute() {
  const h = location.hash.replace(/^#\/?/, '').split('?')[0];
  const seg = h.split('/').filter(Boolean).map(decodeURIComponent);
  return { name: seg[0] || 'home', p: seg.slice(1) };
}
const NAV_OF = { home: 'home', group: 'home', session: 'home', brief: 'home', trainee: 'home', exsum: 'home', manage: 'manage', exercise: 'manage', timer: 'timer', metronome: 'metro', settings: 'settings' };
function navHtml(active) {
  const items = [['home', '/', 'users', 'nav.groups'], ['manage', '/manage', 'list', 'nav.manage'], ['timer', '/timer', 'timer', 'nav.timer'], ['metro', '/metronome', 'metro', 'nav.metro'], ['settings', '/settings', 'sliders', 'nav.settings']];
  return `<div class="brand">${t('app.name')}</div>` + items.map(([id, href, ic, k]) => `<a href="#${href}" class="${id === active ? 'on' : ''}">${icon(ic)}<span>${t(k)}</span></a>`).join('');
}
function render() {
  const r = parseRoute();
  const view = V[r.name] || V.home;
  document.documentElement.lang = db.settings.lang;
  document.title = t('app.name');
  const out = view(r.p) || { html: '' };
  $('#nav').innerHTML = navHtml(NAV_OF[r.name] || 'home');
  $('#view').innerHTML = out.html;
  if (out.mount) out.mount();
}
window.addEventListener('hashchange', () => {
  leaveFns.splice(0).forEach(f => f());
  closeSheet();
  render();
  window.scrollTo(0, 0);
});
function applyTheme() {
  const th = db.settings.theme;
  if (th === 'light' || th === 'dark') document.documentElement.dataset.theme = th;
  else document.documentElement.removeAttribute('data-theme');
}

// ---------- shared html ----------
function header(title, { back, actions = '', sub = '' } = {}) {
  return `<header class="top">${back ? `<a class="icon-btn" href="#${back}" aria-label="${t('back')}">${icon('left')}</a>` : ''}<div class="top-t"><h1>${esc(title)}</h1>${sub ? `<div class="sub">${esc(sub)}</div>` : ''}</div><div class="top-a">${actions}</div></header>`;
}
const notFound = () => ({ html: header(t('app.name'), { back: '/' }) + `<div class="page"><div class="empty-state"><p>${t('notfound')}</p></div></div>` });

// ---------- sheets ----------
function openSheet(html) {
  closeSheet();
  const el = document.createElement('div');
  el.className = 'overlay';
  el.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
  el.addEventListener('pointerdown', e => { if (e.target === el) closeSheet(); });
  document.body.appendChild(el);
  document.body.classList.add('noscroll');
  fitSheet();
  const f = el.querySelector('[autofocus]');
  if (f) setTimeout(() => f.focus(), 30);
}
// Keep the sheet inside the part of the screen not covered by the on-screen keyboard.
function fitSheet() {
  const o = $('.overlay'), v = window.visualViewport;
  if (!o || !v) return;
  o.style.top = v.offsetTop + 'px'; o.style.bottom = 'auto'; o.style.height = v.height + 'px';
}
document.addEventListener('focusin', e => {
  if (!e.target.closest('.sheet') || !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  setTimeout(() => { fitSheet(); e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 250);
});
if (window.visualViewport) { visualViewport.addEventListener('resize', fitSheet); visualViewport.addEventListener('scroll', fitSheet); }
function closeSheet() {
  const o = $('.overlay');
  if (o) o.remove();
  document.body.classList.remove('noscroll');
}
A.closeSheet = closeSheet;

function confirmBox(msg, okLabel, cb, danger = true) {
  ui.cb = cb;
  openSheet(`<h2>${t('confirm')}</h2><p>${esc(msg)}</p><div class="row end"><button class="btn" data-a="closeSheet">${t('cancel')}</button><button class="btn ${danger ? 'danger' : 'primary'}" data-a="confirmOk">${esc(okLabel)}</button></div>`);
}
A.confirmOk = () => { const cb = ui.cb; closeSheet(); if (cb) cb(); };

function promptBox(title, label, value, cb) {
  ui.cb = cb;
  openSheet(`<h2>${esc(title)}</h2><form data-f="promptOk"><label class="f">${esc(label)}<input type="text" name="v" value="${esc(value)}" autocomplete="off" autofocus required></label><div class="row end"><button type="button" class="btn" data-a="closeSheet">${t('cancel')}</button><button class="btn primary">${t('save')}</button></div></form>`);
}
F.promptOk = fd => { const v = String(fd.get('v') || '').trim(); const cb = ui.cb; if (!v) return; closeSheet(); if (cb) cb(v); };

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast'; el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}
