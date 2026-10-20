// Domain logic: stages, streaks, prefill, matrix data.
const sessionCmp = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.created || 0) - (b.created || 0));
const isSet = e => !!(e.progId || e.text);
const ek = item => (item.exId ? item.exId : 'n:' + norm(item.name));
const ladder = key => getExercise(key)?.steps || [];
const itemName = it => (it.exId && getExercise(it.exId) ? getExercise(it.exId).name : it.name);

function exName(key) {
  const ex = getExercise(key);
  if (ex) return ex.name;
  const en = db.entries.find(e => e.ek === key && e.exName);
  if (en) return en.exName;
  return key.startsWith('n:') ? key.slice(2) : '?';
}

function entryLabel(e) {
  if (e.progId) { const s = ladder(e.ek).find(x => x.id === e.progId); return s ? s.label : (e.label || '?'); }
  return e.text || '';
}
const sameStage = (a, b) => (a.progId || b.progId ? a.progId === b.progId : norm(a.text) === norm(b.text));
const sameExact = (a, b) => sameStage(a, b) && norm(a.reps) === norm(b.reps);

// All set entries of a trainee for one exercise, newest session first.
function history(tid, key) {
  const out = [];
  for (const e of db.entries) {
    if (e.traineeId !== tid || e.ek !== key || !isSet(e)) continue;
    const s = getSession(e.sessionId);
    if (s) out.push({ e, s });
  }
  return out.sort((x, y) => sessionCmp(y.s, x.s));
}

// Consecutive attended sessions on the same stage (n) and on the same stage+reps (exact), starting at index i.
function streakAt(h, i) {
  if (i < 0 || i >= h.length) return { n: 0, exact: 0 };
  const base = h[i].e;
  let n = 1; while (i + n < h.length && sameStage(h[i + n].e, base)) n++;
  let x = 1; while (i + x < h.length && sameExact(h[i + x].e, base)) x++;
  return { n, exact: x };
}

// Latest done (not in the future) entry with its streak.
function latest(tid, key) {
  const h = history(tid, key), today = todayStr();
  const i = h.findIndex(x => x.s.date <= today);
  if (i < 0) return null;
  return { e: h[i].e, s: h[i].s, streak: streakAt(h, i) };
}
// Entry of the nearest planned (future) session, if any.
function planned(tid, key) {
  const today = todayStr();
  const f = history(tid, key).filter(x => x.s.date > today);
  return f.length ? f[f.length - 1].e : null;
}
// What the trainee did before this session (for prefill and "last time").
function prevEntry(s, tid, key) {
  const x = history(tid, key).find(h => h.s.id !== s.id && sessionCmp(h.s, s) <= 0);
  return x ? x.e : null;
}
const getEntry = (sid, tid, key) => db.entries.find(e => e.sessionId === sid && e.traineeId === tid && e.ek === key);

function prefill(s, tid, key) {
  const p = prevEntry(s, tid, key);
  if (!p) return {};
  const o = {};
  if (p.progId) { o.progId = p.progId; o.label = p.label; } else if (p.text) o.text = p.text;
  if (p.reps) o.reps = p.reps;
  return o;
}

// Make entries match attendees x strength items: create missing (prefilled from last time), drop orphans.
function syncEntries(s) {
  const keys = new Map();
  for (const b of s.blocks) if (b.type === 'strength') for (const it of b.items) keys.set(ek(it), it);
  db.entries = db.entries.filter(e => e.sessionId !== s.id || (s.attendeeIds.includes(e.traineeId) && keys.has(e.ek)));
  for (const tid of s.attendeeIds) {
    for (const [k, it] of keys) {
      const ex = getEntry(s.id, tid, k);
      if (ex) { ex.exName = itemName(it); continue; }
      db.entries.push({ id: uid(), sessionId: s.id, traineeId: tid, ek: k, exId: it.exId || null, exName: itemName(it), ...prefill(s, tid, k) });
    }
  }
}

const cloneBlocks = blocks => JSON.parse(JSON.stringify(blocks)).map(b => ({ ...b, id: uid(), items: b.items.map(i => ({ ...i, id: uid() })) }));

const activeMembers = g => g.traineeIds.map(getTrainee).filter(x => x && x.active !== false).sort(byName);

function groupColumns(g) {
  const main = new Map();
  for (const b of g.template || []) if (b.type === 'strength') for (const it of b.items) { const k = ek(it); if (!main.has(k)) main.set(k, { key: k }); }
  const members = new Set(g.traineeIds), extra = new Map();
  for (const e of db.entries) if (members.has(e.traineeId) && !main.has(e.ek) && isSet(e)) extra.set(e.ek, { key: e.ek });
  return { main: [...main.values()], extra: [...extra.values()].sort((a, b) => exName(a.key).localeCompare(exName(b.key), locale())) };
}

// list: [{t, e, streak}] -> stage groups ordered along the ladder (free texts last) + people without data.
function groupByStage(list, key) {
  const lad = ladder(key), map = new Map(), none = [];
  for (const it of list) {
    if (!it.e || !isSet(it.e)) { none.push(it); continue; }
    const id = it.e.progId ? 'p:' + it.e.progId : 't:' + norm(it.e.text);
    let g = map.get(id);
    if (!g) { g = { label: entryLabel(it.e), idx: it.e.progId ? lad.findIndex(s => s.id === it.e.progId) : -1, isText: !it.e.progId, items: [] }; map.set(id, g); }
    g.items.push(it);
  }
  const groups = [...map.values()].sort((a, b) => (a.isText - b.isText) || (a.idx - b.idx) || a.label.localeCompare(b.label, locale()));
  groups.forEach(g => g.items.sort((a, b) => byName(a.t, b.t)));
  none.sort((a, b) => byName(a.t, b.t));
  return { groups, none };
}
