const STORE_KEY = 'workout-program.v1';
let db;
let _ix = null;

const DEFAULTS = () => ({
  v: 2,
  settings: {
    lang: 'hu', theme: 'auto', threshold: 4, vol: 0.7, lastBackup: null,
    timer: { rounds: 3, n: 3, work: 40, rest: 20, roundRest: 60, prep: 5, names: '' },
    metro: { sec: 1, accent: 0 },
  },
  trainees: [], groups: [], exercises: [], templates: [], sessions: [], entries: [],
});

function normalizeDb(raw) {
  const d = DEFAULTS();
  if (!raw || typeof raw !== 'object') return d;
  for (const k of ['trainees', 'groups', 'exercises', 'templates', 'sessions', 'entries']) if (Array.isArray(raw[k])) d[k] = raw[k];
  const s = raw.settings;
  if (s && typeof s === 'object') {
    d.settings = { ...d.settings, ...s, timer: { ...d.settings.timer, ...(s.timer || {}) }, metro: { ...d.settings.metro, ...(s.metro || {}) } };
  }
  for (const x of d.trainees) delete x.active;
  // v2: only ticked/edited rows count. Everything logged before that rule existed counts as done.
  if ((raw.v || 1) < 2) {
    const byId = new Map(d.sessions.map(s => [s.id, s])), today = todayStr();
    for (const e of d.entries) { const s = byId.get(e.sessionId); if (e.done === undefined && s && s.date < today) e.done = true; }
  }
  d.v = 2;
  // Reps are a plain number now ("3x8" -> 8); anything else moves into the note. Rounds come from the block.
  const sess = new Map(d.sessions.map(s => [s.id, s]));
  for (const e of d.entries) {
    if (e.reps !== undefined && e.reps !== '') {
      const m = String(e.reps).trim().match(/^(?:\d+\s*[x×*]\s*)?(\d+)$/i);
      if (m) e.reps = m[1];
      else { e.note = [e.note, e.reps].filter(Boolean).join('; '); delete e.reps; }
    }
    if (e.rounds === undefined) {
      const s = sess.get(e.sessionId), b = s && s.blocks.find(x => x.type === 'strength' && x.items.some(i => (i.exId || 'n:' + norm(i.name)) === e.ek));
      if (b) e.rounds = b.rounds;
    }
  }
  // Older data kept the usual workout as blocks inside the group: turn it into a named template.
  for (const g of d.groups) {
    if (!Array.isArray(g.template)) continue;
    const ids = [];
    for (const b of g.template) if (b.type === 'strength') for (const it of b.items) if (it.exId && !ids.includes(it.exId)) ids.push(it.exId);
    if (ids.length && !g.templateId) { const tp = { id: uid(), name: g.name, exIds: ids }; d.templates.push(tp); g.templateId = tp.id; }
    delete g.template;
  }
  return d;
}

let storageOk = true, dataSize = 0;
function load() {
  let s = null;
  try { s = localStorage.getItem(STORE_KEY); db = normalizeDb(s ? JSON.parse(s) : null); dataSize = s ? s.length : 0; }
  catch (e) {
    db = DEFAULTS();
    // unreadable data: keep a copy so the next save does not silently overwrite it
    try { if (s) localStorage.setItem(STORE_KEY + '.corrupt', s); } catch (e2) { storageOk = false; }
  }
  try { localStorage.setItem(STORE_KEY + '.probe', '1'); localStorage.removeItem(STORE_KEY + '.probe'); } catch (e) { storageOk = false; }
  // ask the browser not to evict the data when it is short on space
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* optional */ }
}

function save() {
  _ix = null;
  try { const s = JSON.stringify(db); dataSize = s.length; localStorage.setItem(STORE_KEY, s); }
  catch (e) { storageOk = false; toast(t('err.save')); }
}
const bigData = () => dataSize > 2.5e6; // localStorage holds roughly 5M characters

// Lookup maps, rebuilt lazily after every save().
function ix() {
  if (!_ix) {
    _ix = {
      sess: new Map(db.sessions.map(s => [s.id, s])),
      ex: new Map(db.exercises.map(x => [x.id, x])),
      tr: new Map(db.trainees.map(x => [x.id, x])),
      gr: new Map(db.groups.map(x => [x.id, x])),
      tp: new Map(db.templates.map(x => [x.id, x])),
    };
  }
  return _ix;
}
const getSession = id => ix().sess.get(id);
const getExercise = id => ix().ex.get(id);
const getTrainee = id => ix().tr.get(id);
const getGroup = id => ix().gr.get(id);
const getTemplate = id => (id ? ix().tp.get(id) : undefined);

function deleteSessionData(ids) {
  const set = new Set(ids);
  db.sessions = db.sessions.filter(s => !set.has(s.id));
  db.entries = db.entries.filter(e => !set.has(e.sessionId));
}
function deleteTrainee(id) {
  db.groups.filter(g => g.solo && g.traineeIds.length === 1 && g.traineeIds[0] === id).forEach(g => deleteGroup(g.id));
  db.trainees = db.trainees.filter(x => x.id !== id);
  db.groups.forEach(g => { g.traineeIds = g.traineeIds.filter(x => x !== id); });
  db.sessions.forEach(s => { s.attendeeIds = s.attendeeIds.filter(x => x !== id); });
  db.entries = db.entries.filter(e => e.traineeId !== id);
}
function deleteGroup(id) {
  deleteSessionData(db.sessions.filter(s => s.groupId === id).map(s => s.id));
  db.groups = db.groups.filter(g => g.id !== id);
}

function exportData() {
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `edzeskovet-adatok-${todayStr()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  db.settings.lastBackup = todayStr();
  save();
  render();
}
function importData(text) {
  let raw;
  try { raw = JSON.parse(text); } catch (e) { return false; }
  if (!raw || !Array.isArray(raw.trainees) || !Array.isArray(raw.sessions) || !Array.isArray(raw.groups)) return false;
  db = normalizeDb(raw);
  save();
  return true;
}
