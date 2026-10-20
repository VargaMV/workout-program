const STORE_KEY = 'workout-program.v1';
let db;
let _ix = null;

const DEFAULTS = () => ({
  v: 1,
  settings: {
    lang: 'hu', theme: 'auto', threshold: 4, vol: 0.7, lastBackup: null,
    timer: { rounds: 3, n: 3, work: 40, rest: 20, roundRest: 60, prep: 5, names: '' },
    metro: { sec: 1, accent: 0 },
  },
  trainees: [], groups: [], exercises: [], sessions: [], entries: [],
});

function normalizeDb(raw) {
  const d = DEFAULTS();
  if (!raw || typeof raw !== 'object') return d;
  for (const k of ['trainees', 'groups', 'exercises', 'sessions', 'entries']) if (Array.isArray(raw[k])) d[k] = raw[k];
  const s = raw.settings;
  if (s && typeof s === 'object') {
    d.settings = { ...d.settings, ...s, timer: { ...d.settings.timer, ...(s.timer || {}) }, metro: { ...d.settings.metro, ...(s.metro || {}) } };
  }
  return d;
}

function load() {
  try { const s = localStorage.getItem(STORE_KEY); db = normalizeDb(s ? JSON.parse(s) : null); }
  catch (e) { db = DEFAULTS(); }
}

function save() {
  _ix = null;
  try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); }
  catch (e) { toast(t('err.save')); }
}

// Lookup maps, rebuilt lazily after every save().
function ix() {
  if (!_ix) {
    _ix = {
      sess: new Map(db.sessions.map(s => [s.id, s])),
      ex: new Map(db.exercises.map(x => [x.id, x])),
      tr: new Map(db.trainees.map(x => [x.id, x])),
      gr: new Map(db.groups.map(x => [x.id, x])),
    };
  }
  return _ix;
}
const getSession = id => ix().sess.get(id);
const getExercise = id => ix().ex.get(id);
const getTrainee = id => ix().tr.get(id);
const getGroup = id => ix().gr.get(id);

function deleteSessionData(ids) {
  const set = new Set(ids);
  db.sessions = db.sessions.filter(s => !set.has(s.id));
  db.entries = db.entries.filter(e => !set.has(e.sessionId));
}
function deleteTrainee(id) {
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
