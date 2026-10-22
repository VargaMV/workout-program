// Interval timer and metronome. Both run on the Web Audio clock so sounds stay exact and pausing is trivial.
let T = null; // interval timer state

function initTimer(p) {
  let cfg = { ...db.settings.timer }, back = null;
  if (p.length === 3) {
    const c = getCtx(p[0] + ':' + p[1]);
    const b = c && findBlock(c, p[2]);
    if (b && b.type === 'interval') {
      cfg = { rounds: b.rounds, n: Math.max(1, b.items.length), work: b.work, rest: b.rest, roundRest: b.roundRest, prep: db.settings.timer.prep, names: b.items.map(ivLabel).join('\n') };
      back = '/session/' + p[1];
    }
  }
  return { mode: 'setup', cfg, back, phases: [], total: 0, pi: -1 };
}

function tmPhases(c) {
  const ph = []; let s = 0;
  const add = (type, d, r, i) => { if (d > 0) { ph.push({ type, d, s, r, i }); s += d; } };
  add('prep', c.prep, -1, -1);
  for (let r = 0; r < c.rounds; r++) {
    for (let i = 0; i < c.n; i++) {
      add('work', c.work, r, i);
      const last = r === c.rounds - 1 && i === c.n - 1;
      if (!last) add(i === c.n - 1 ? 'roundrest' : 'rest', i === c.n - 1 ? c.roundRest : c.rest, r, i);
    }
  }
  return { ph, total: s };
}
function tmEvents(ph, total) {
  const ev = [];
  const kinds = { work: 'go', rest: 'rest', roundrest: 'rr' };
  for (const p of ph) {
    if (kinds[p.type]) ev.push({ t: p.s, k: kinds[p.type] });
    for (let j = 3; j >= 1; j--) if (p.d > j) ev.push({ t: p.s + p.d - j, k: 'tick' });
  }
  ev.push({ t: total, k: 'end' });
  return ev.sort((a, b) => a.t - b.t);
}
const tmNames = c => c.names.split('\n').map(x => x.trim()).filter(Boolean);
const tmLabel = (c, i) => tmNames(c)[i] || `${t('exercise')} ${i + 1}`;
const tmTotal = c => tmPhases(c).total;

V.timer = p => {
  if (!T) { T = initTimer(p); onLeave(tmStop); }
  return { html: timerHtml(), mount: tmMount };
};
const renderTimer = () => { $('#view').innerHTML = timerHtml(); tmMount(); };
const tmMount = () => { if (T && T.mode === 'run') tmFrame(true); };

function timerHtml() {
  const hd = header(t('nav.timer'), { back: T.back || undefined });
  if (T.mode === 'setup') {
    const c = T.cfg;
    const num = (k, label, step = 1) => `<label class="f">${label}<div class="stepper"><button data-a="tmStep" data-k="${k}" data-d="-${step}" aria-label="-">−</button><input type="number" inputmode="numeric" value="${c[k]}" data-c="tmSet" data-k="${k}"><button data-a="tmStep" data-k="${k}" data-d="${step}" aria-label="+">+</button></div></label>`;
    return hd + `<div class="page"><div class="card"><div class="fields">${num('work', t('tm.work'), 5)}${num('rest', t('tm.rest'), 5)}${num('roundRest', t('tm.roundRest'), 5)}${num('prep', t('tm.prep'), 5)}${num('rounds', t('rounds'))}${num('n', t('tm.perRound'))}
      <label class="f full">${t('tm.names')}<textarea data-c="tmNames" placeholder="${t('tm.names.ph')}">${esc(c.names)}</textarea></label></div>
      <div class="total" id="tmTotal">${t('tm.total', { d: fmtDur(tmTotal(c)) })}</div>
      <label class="f">${t('volume')}<input type="range" min="0" max="100" value="${Math.round(db.settings.vol * 100)}" data-i="vol"></label>
      <div class="row" style="justify-content:center"><button class="btn primary big-play" data-a="tmStart">${icon('play')} ${t('tm.start')}</button></div>
      <p class="muted" style="text-align:center">${t('tm.help')}</p></div></div>`;
  }
  const c = T.cfg;
  if (T.mode === 'done') {
    return hd + `<div class="page"><div class="tm tm-done"><div class="tm-phase">${t('tm.done')}</div><div class="tm-ex">${t('tm.total', { d: fmtDur(T.total) })}</div>
      <div class="tm-ctl"><button class="btn primary" data-a="tmStart">${icon('play')} ${t('tm.again')}</button><button class="btn" data-a="tmSetup">${t('tm.setup')}</button></div></div></div>`;
  }
  const p = T.phases[Math.max(0, T.pi)] || T.phases[0];
  const nx = T.phases[T.pi + 1];
  const nextTxt = nx ? t('tm.next') + ': ' + (nx.type === 'work' ? tmLabel(c, nx.i) : t('ph.' + nx.type)) : t('tm.last');
  const top = p.type === 'prep' ? t('tm.getready') : t('tm.pos', { r: p.r + 1, rs: c.rounds, i: p.i + 1, n: c.n });
  const exTxt = p.type === 'work' ? tmLabel(c, p.i) : p.type === 'prep' ? tmLabel(c, 0) : (p.i + 1 < c.n && p.type === 'rest' ? tmLabel(c, p.i + 1) : '');
  return hd + `<div class="page"><div class="tm tm-${p.type}"><div class="tm-top">${top}</div><div class="tm-phase">${t('ph.' + p.type)}</div>
    <div class="tm-count" id="tmCount">0</div><div class="tm-ex">${esc(exTxt)}</div><div class="tm-next">${esc(nextTxt)}</div>
    <div class="tm-bar"><i id="tmBar"></i></div>
    <div class="tm-ctl"><button class="btn" data-a="tmPrev" aria-label="${t('prev')}">${icon('prev')}</button>
      <button class="btn primary" data-a="tmPause" aria-label="${t('tm.pause')}">${icon(T.paused ? 'play' : 'pause')}</button>
      <button class="btn" data-a="tmNext" aria-label="${t('next')}">${icon('next')}</button>
      <button class="btn" data-a="tmSetup" aria-label="${t('stop')}">${icon('stop')}</button></div></div></div>`;
}

A.tmStep = d => {
  const k = d.k, lim = { work: [1, 3600], rest: [0, 3600], roundRest: [0, 3600], prep: [0, 60], rounds: [1, 20], n: [1, 12] }[k];
  T.cfg[k] = clamp(T.cfg[k] + +d.d, lim[0], lim[1]);
  tmPersist(); renderTimer();
};
C.tmSet = (v, d) => { const lim = { work: [1, 3600], rest: [0, 3600], roundRest: [0, 3600], prep: [0, 60], rounds: [1, 20], n: [1, 12] }[d.k]; T.cfg[d.k] = num(v, T.cfg[d.k], lim[0], lim[1]); tmPersist(); renderTimer(); };
C.tmNames = v => { T.cfg.names = v; tmPersist(); };
function tmPersist() { if (!T.back) db.settings.timer = { ...T.cfg }; save(); }
I.vol = v => { audio(); setVolume(v / 100); };
C.vol = () => save();

function tmSchedule(from) {
  for (const ev of T.events) if (ev.t >= from - 0.001) cue(T.bus, ev.k, T.t0 + ev.t);
}
A.tmStart = async () => {
  const ac = audio();
  if (ac) await ac.resume();
  const { ph, total } = tmPhases(T.cfg);
  if (!ph.length) return;
  T.phases = ph; T.total = total; T.events = tmEvents(ph, total);
  T.mode = 'run'; T.paused = false; T.pi = -1;
  if (ac) { T.bus = newBus(); T.t0 = ac.currentTime + 0.2; tmSchedule(0); } else T.t0 = 0;
  keepAwake(true);
  renderTimer();
  tmLoop();
};
const tmNow = () => Math.max(0, (AC ? AC.currentTime : 0) - T.t0);
function tmFrame(force) {
  if (!T || T.mode !== 'run') return;
  const el = tmNow();
  if (el >= T.total) { tmFinish(); return; }
  let pi = Math.max(0, T.pi);
  while (pi + 1 < T.phases.length && el >= T.phases[pi + 1].s) pi++;
  while (pi > 0 && el < T.phases[pi].s) pi--;
  if (pi !== T.pi) {
    const first = T.pi < 0;
    T.pi = pi;
    renderTimer();
    if (!first && navigator.vibrate) navigator.vibrate(120);
    return;
  }
  const p = T.phases[pi];
  const cnt = $('#tmCount'), bar = $('#tmBar');
  if (cnt) cnt.textContent = Math.max(0, Math.ceil(p.s + p.d - el - 0.001));
  if (bar) bar.style.width = (100 * (el - p.s) / p.d).toFixed(1) + '%';
}
function tmLoop() {
  if (!T || T.mode !== 'run') return;
  tmFrame();
  T.raf = requestAnimationFrame(tmLoop);
}
function tmFinish() {
  cancelAnimationFrame(T.raf);
  T.mode = 'done'; keepAwake(false);
  renderTimer();
}
function tmStop() {
  if (!T) return;
  cancelAnimationFrame(T.raf);
  if (T.bus) { try { T.bus.disconnect(); } catch (e) { /* already gone */ } }
  if (AC && AC.state === 'suspended') AC.resume();
  keepAwake(false);
  T = null;
}
A.tmSetup = () => { if (AC && T.bus) { try { T.bus.disconnect(); } catch (e) { /* ignore */ } } cancelAnimationFrame(T.raf); if (AC && AC.state === 'suspended') AC.resume(); keepAwake(false); T.mode = 'setup'; T.paused = false; renderTimer(); };
A.tmPause = () => {
  if (!AC) return;
  T.paused = !T.paused;
  if (T.paused) AC.suspend(); else AC.resume();
  renderTimer();
};
// Jump the clock: moving t0 shifts "now" along the timeline; already queued sounds are replaced.
function tmJump(target) {
  const el = tmNow();
  T.t0 -= (target - el);
  try { T.bus.disconnect(); } catch (e) { /* ignore */ }
  T.bus = newBus();
  tmSchedule(target);
  if (target >= T.total) { tmFinish(); return; }
  tmFrame();
}
A.tmNext = () => {
  const el = tmNow(), nx = T.phases.find(p => p.s > el + 0.01);
  tmJump(nx ? nx.s : T.total);
};
A.tmPrev = () => {
  const el = tmNow(), cur = T.phases[Math.max(0, T.pi)];
  const prev = el - cur.s > 2 ? cur : (T.phases[T.phases.indexOf(cur) - 1] || cur);
  tmJump(prev.s);
};

// ---------- metronome ----------
let M = null;
V.metronome = () => {
  if (!M) { M = { on: false, beat: 0, q: [] }; onLeave(mStop); }
  return { html: metroHtml(), mount: () => { if (M.on) mLoop(); } };
};
function metroHtml() {
  const c = db.settings.metro;
  const opts = [[0, t('metro.noaccent')], [2, '2'], [3, '3'], [4, '4']];
  return header(t('nav.metro')) + `<div class="page"><div class="metro"><div class="dot" id="mDot"><span id="mCount">${M.on ? M.beat : '–'}</span></div>
    <button class="btn ${M.on ? '' : 'primary'} big-play" data-a="mToggle">${icon(M.on ? 'stop' : 'play')} ${M.on ? t('stop') : t('tm.start')}</button></div>
    <div class="card" style="margin-top:18px"><label class="f">${t('metro.interval')}<div class="stepper"><button data-a="mSec" data-d="-1" aria-label="-">−</button><input type="number" inputmode="numeric" min="1" max="30" value="${c.sec}" data-c="mSecSet"><button data-a="mSec" data-d="1" aria-label="+">+</button></div></label>
    <div class="muted" style="margin-bottom:6px">${t('metro.accent')}</div><div class="seg">${opts.map(([v, l]) => `<button class="${c.accent === v ? 'on' : ''}" data-a="mAccent" data-v="${v}">${l}</button>`).join('')}</div>
    <label class="f" style="margin-top:14px">${t('volume')}<input type="range" min="0" max="100" value="${Math.round(db.settings.vol * 100)}" data-i="vol"></label></div></div>`;
}
function mSched() {
  const c = db.settings.metro;
  while (M.next < AC.currentTime + 3) {
    const acc = c.accent > 0 && M.n % c.accent === 0;
    click(M.bus, M.next, acc);
    M.q.push({ t: M.next, acc });
    M.n++; M.next += c.sec;
  }
}
async function mStart() {
  if (M.starting) return;
  M.starting = true;
  const ac = audio();
  if (!ac) { M.starting = false; toast(t('err.audio')); return; }
  await ac.resume();
  M.starting = false;
  if (!M) return;
  M.on = true; M.beat = 0; M.n = 0; M.q = [];
  M.bus = newBus(); M.next = ac.currentTime + 0.1;
  mSched(); M.timer = setInterval(mSched, 250);
  keepAwake(true);
  renderMetro();
}
function mStop() {
  if (!M) return;
  clearInterval(M.timer); cancelAnimationFrame(M.raf);
  if (M.bus) { try { M.bus.disconnect(); } catch (e) { /* ignore */ } }
  M.on = false; keepAwake(false);
  M = null;
}
const renderMetro = () => { $('#view').innerHTML = metroHtml(); if (M.on) mLoop(); };
function mLoop() {
  cancelAnimationFrame(M.raf);
  const step = () => {
    if (!M || !M.on) return;
    let hit = null;
    while (M.q.length && M.q[0].t <= AC.currentTime) hit = M.q.shift();
    if (hit) {
      M.beat++;
      const dot = $('#mDot'), cnt = $('#mCount');
      if (cnt) cnt.textContent = M.beat;
      if (dot) { dot.classList.remove('beat', 'acc'); void dot.offsetWidth; dot.classList.add('beat'); if (hit.acc) dot.classList.add('acc'); }
    }
    M.raf = requestAnimationFrame(step);
  };
  step();
}
A.mToggle = () => { if (M.on) { clearInterval(M.timer); cancelAnimationFrame(M.raf); try { M.bus.disconnect(); } catch (e) { /* ignore */ } M.on = false; keepAwake(false); renderMetro(); } else mStart(); };
function mRestart() {
  if (!M.on) return;
  try { M.bus.disconnect(); } catch (e) { /* ignore */ }
  M.bus = newBus(); M.next = AC.currentTime + 0.05; M.q = []; M.n = 0;
  mSched();
}
A.mSec = d => { const c = db.settings.metro; c.sec = clamp(c.sec + +d.d, 1, 30); save(); mRestart(); renderMetro(); };
C.mSecSet = v => { db.settings.metro.sec = num(v, 1, 1, 30); save(); mRestart(); renderMetro(); };
A.mAccent = d => { db.settings.metro.accent = +d.v; save(); mRestart(); renderMetro(); };
