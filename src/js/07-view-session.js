// Block editor (shared by sessions and group templates), session page, block briefing.
function getCtx(cs) {
  const [k, id] = cs.split(':');
  if (k === 's') {
    const s = getSession(id);
    return s && { kind: 's', s, blocks: s.blocks, after: () => { syncEntries(s); save(); render(); } };
  }
  const g = getGroup(id);
  if (!g) return null;
  g.template = g.template || [];
  return { kind: 't', g, blocks: g.template, after: () => { save(); render(); } };
}
const findBlock = (c, id) => c.blocks.find(b => b.id === id);
const dctx = (cs, b) => `data-ctx="${cs}" data-b="${b.id}"`;

function blocksHtml(cs) {
  const c = getCtx(cs);
  const out = c.blocks.map((b, bi) => blockHtml(c, cs, b, bi)).join('');
  return `<div class="blocks">${out}</div><div class="row">
    <button class="btn" data-a="addBlock" data-ctx="${cs}" data-type="strength">${icon('plus')} ${t('block.addStrength')}</button>
    <button class="btn" data-a="addBlock" data-ctx="${cs}" data-type="interval">${icon('plus')} ${t('block.addInterval')}</button></div>`;
}

function blockHtml(c, cs, b, bi) {
  const d = dctx(cs, b), n = c.blocks.length, strength = b.type === 'strength';
  const head = `<div class="block-h"><div class="block-t"><span class="bn">${bi + 1}</span><strong>${t(strength ? 'block.strength' : 'block.interval')}</strong></div><div class="block-a">
    ${strength ? `<label class="rounds">${t('rounds')}<input type="number" inputmode="numeric" min="1" max="20" value="${b.rounds}" data-c="blockRounds" ${d}></label>` : ''}
    <button class="icon-btn sm" data-a="moveBlock" ${d} data-dir="-1" ${bi === 0 ? 'disabled' : ''} aria-label="${t('up')}">${icon('up')}</button>
    <button class="icon-btn sm" data-a="moveBlock" ${d} data-dir="1" ${bi === n - 1 ? 'disabled' : ''} aria-label="${t('down')}">${icon('down')}</button>
    <button class="icon-btn sm" data-a="delBlock" ${d} aria-label="${t('delete')}">${icon('trash')}</button></div></div>`;
  const items = b.items.map((it, ii) => strength ? strengthItemHtml(c, cs, b, it, ii) : intervalItemHtml(cs, b, it, ii)).join('');
  let foot;
  if (strength) {
    foot = `<div class="row"><button class="btn small" data-a="addItem" ${d}>${icon('plus')} ${t('item.add')}</button>${c.kind === 's' && b.items.length ? `<a class="btn small primary" href="#/brief/${c.s.id}/${b.id}">${t('brief.open')}</a>` : ''}</div>`;
  } else {
    foot = `<div class="row"><button class="btn small" data-a="addItem" ${d}>${icon('plus')} ${t('item.add')}</button><a class="btn small primary" href="#/timer/${cs.replace(':', '/')}/${b.id}">${icon('timer')} ${t('timer.start')}</a></div>`;
  }
  const sum = strength ? '' : `<div class="iv-sum">${t('iv.sum', { w: b.work, r: b.rest, z: b.roundRest, n: b.rounds })}<button class="link-btn" data-a="editInterval" ${d}>${t('edit')}</button></div>`;
  return `<section class="block ${strength ? '' : 'iv'}">${head}<div class="block-b">${sum}${items || `<p class="muted">${t('block.empty')}</p>`}${foot}</div></section>`;
}

function itemControls(cs, b, it, ii) {
  const d = `${dctx(cs, b)} data-it="${it.id}"`;
  return `<div class="item-a"><button class="icon-btn sm" data-a="moveItem" ${d} data-dir="-1" ${ii === 0 ? 'disabled' : ''} aria-label="${t('up')}">${icon('up')}</button><button class="icon-btn sm" data-a="moveItem" ${d} data-dir="1" ${ii === b.items.length - 1 ? 'disabled' : ''} aria-label="${t('down')}">${icon('down')}</button><button class="icon-btn sm" data-a="delItem" ${d} aria-label="${t('delete')}">${icon('x')}</button></div>`;
}
const intervalItemHtml = (cs, b, it, ii) => `<div class="iv-item"><span>${ii + 1}. ${esc(itemName(it))}</span>${itemControls(cs, b, it, ii)}</div>`;

function strengthItemHtml(c, cs, b, it, ii) {
  const key = ek(it);
  let rows = '';
  if (c.kind === 's') {
    const s = c.s;
    const people = s.attendeeIds.map(getTrainee).filter(Boolean).sort(byName);
    rows = people.map(tr => traineeRow(s, tr, key)).join('') || `<p class="muted">${t('session.noatt')}</p>`;
  }
  return `<div class="item"><div class="item-h"><div class="item-n">${esc(itemName(it))}${it.exId ? '' : `<span class="tag">${t('freetext')}</span>`}</div>${itemControls(cs, b, it, ii)}</div>${rows}</div>`;
}

function traineeRow(s, tr, key) {
  const e = getEntry(s.id, tr.id, key);
  if (!e) return '';
  const prev = prevEntry(s, tr.id, key);
  const h = history(tr.id, key);
  const sk = streakAt(h, h.findIndex(x => x.e === e));
  const set = isSet(e);
  const changed = set && prev && !sameStage(e, prev);
  const lad = ladder(key);
  const idx = e.progId ? lad.findIndex(x => x.id === e.progId) : -1;
  const canUp = lad.length && !e.text && idx < lad.length - 1;
  const d = `data-s="${s.id}" data-t="${tr.id}" data-k="${esc(key)}"`;
  return `<div class="trow"><div class="tn"><a href="#/trainee/${tr.id}">${esc(tr.name)}</a>${tr.note ? `<span class="prev warn-note">${esc(tr.note)}</span>` : ''}<span class="prev">${prev ? t('last') + ': ' + esc(entryLabel(prev)) + (prev.reps ? ' · ' + esc(prev.reps) : '') : t('first')}</span></div>
    <div class="tctl"><button class="stage ${set ? '' : 'unset'} ${changed ? 'changed' : ''}" data-a="stage" ${d}><span>${set ? esc(entryLabel(e)) : t('stage.unset')}</span><span class="badges">${set ? streakChips(sk) : ''}</span></button>${canUp ? `<button class="mini" data-a="nextStep" ${d} aria-label="${t('stage.next')}" title="${t('stage.next')}">${icon('up')}</button>` : ''}<input type="text" class="reps" value="${esc(e.reps || '')}" placeholder="${t('reps.ph')}" data-c="reps" ${d}></div></div>`;
}

// ----- block / item actions -----
A.addBlock = d => {
  const c = getCtx(d.ctx);
  c.blocks.push(d.type === 'strength' ? { id: uid(), type: 'strength', rounds: 3, items: [] } : { id: uid(), type: 'interval', rounds: 3, work: 40, rest: 20, roundRest: 60, items: [] });
  c.after();
};
A.delBlock = d => confirmBox(t('block.delq'), t('delete'), () => { const c = getCtx(d.ctx); c.blocks.splice(c.blocks.findIndex(b => b.id === d.b), 1); c.after(); });
A.moveBlock = d => { const c = getCtx(d.ctx); move(c.blocks, c.blocks.findIndex(b => b.id === d.b), +d.dir); c.after(); };
C.blockRounds = (v, d) => { const b = findBlock(getCtx(d.ctx), d.b); b.rounds = num(v, 3, 1, 20); save(); };
A.moveItem = d => { const b = findBlock(getCtx(d.ctx), d.b); move(b.items, b.items.findIndex(i => i.id === d.it), +d.dir); getCtx(d.ctx).after(); };
A.delItem = d => { const c = getCtx(d.ctx), b = findBlock(c, d.b); b.items.splice(b.items.findIndex(i => i.id === d.it), 1); c.after(); };

A.editInterval = d => {
  const b = findBlock(getCtx(d.ctx), d.b);
  const f = (name, label, v) => `<label class="f">${label}<input type="number" inputmode="numeric" name="${name}" min="0" max="3600" value="${v}"></label>`;
  openSheet(`<h2>${t('block.interval')}</h2><form data-f="saveInterval" data-ctx="${d.ctx}" data-b="${d.b}"><div class="fields">${f('rounds', t('rounds'), b.rounds)}${f('work', t('tm.work'), b.work)}${f('rest', t('tm.rest'), b.rest)}${f('roundRest', t('tm.roundRest'), b.roundRest)}</div><div class="row end"><button type="button" class="btn" data-a="closeSheet">${t('cancel')}</button><button class="btn primary">${t('save')}</button></div></form>`);
};
F.saveInterval = (fd, d) => {
  const c = getCtx(d.ctx), b = findBlock(c, d.b);
  b.rounds = num(fd.get('rounds'), 3, 1, 20); b.work = num(fd.get('work'), 40, 1, 3600);
  b.rest = num(fd.get('rest'), 20, 0, 3600); b.roundRest = num(fd.get('roundRest'), 60, 0, 3600);
  closeSheet(); c.after();
};

// ----- exercise picker -----
A.addItem = d => {
  ui.pick = { ctx: d.ctx, b: d.b };
  openSheet(`<h2>${t('item.add')}</h2><input type="text" id="pickQ" data-i="pickSearch" placeholder="${t('pick.ph')}" autocomplete="off" autofocus><div id="pickRes" class="pick-res">${pickResults('')}</div>`);
};
function pickResults(q) {
  const c = getCtx(ui.pick.ctx), b = findBlock(c, ui.pick.b), nq = norm(q);
  const list = db.exercises.filter(x => (b.type === 'interval' || x.kind === 'strength') && (!nq || norm(x.name).includes(nq))).sort(byName);
  let out = list.map(x => `<button class="btn" data-a="pickEx" data-id="${x.id}">${esc(x.name)}${x.kind === 'strength' ? `<span class="tag">${x.steps.length}</span>` : ''}</button>`).join('');
  if (nq && !db.exercises.some(x => norm(x.name) === nq)) {
    out += `<button class="btn" data-a="pickText">${icon('plus')} ${t('pick.text', { q: esc(q.trim()) })}</button>`;
    if (b.type === 'strength') out += `<button class="btn" data-a="pickNew">${icon('plus')} ${t('pick.new', { q: esc(q.trim()) })}</button>`;
  }
  return out || `<p class="muted">${t('pick.none')}</p>`;
}
I.pickSearch = v => { $('#pickRes').innerHTML = pickResults(v); };
function addItemTo(item) {
  const c = getCtx(ui.pick.ctx), b = findBlock(c, ui.pick.b);
  if (b.type === 'strength') {
    const k = ek(item);
    if (c.blocks.some(x => x.type === 'strength' && x.items.some(i => ek(i) === k))) { toast(t('pick.dup')); return; }
  }
  b.items.push({ id: uid(), ...item });
  closeSheet(); c.after();
}
A.pickEx = ({ id }) => addItemTo({ exId: id, name: getExercise(id).name });
A.pickText = () => addItemTo({ name: $('#pickQ').value.trim() });
A.pickNew = () => {
  const name = $('#pickQ').value.trim();
  const ex = { id: uid(), name, kind: 'strength', steps: [] };
  db.exercises.push(ex); save();
  addItemTo({ exId: ex.id, name });
  toast(t('pick.created'));
};

// ----- session page -----
V.session = ([id]) => {
  const s = getSession(id);
  if (!s) return notFound();
  const g = getGroup(s.groupId);
  const members = g ? activeMembers(g) : [];
  const guests = s.attendeeIds.filter(x => !members.some(m => m.id === x)).map(getTrainee).filter(Boolean);
  const chip = m => `<button class="chip ${s.attendeeIds.includes(m.id) ? 'on' : ''}" data-a="toggleAtt" data-s="${s.id}" data-t="${m.id}">${esc(m.name)}</button>`;
  const body = `<div class="card"><div class="fields"><label class="f">${t('date')}<input type="date" value="${s.date}" data-c="sdate" data-s="${s.id}"></label>
      <label class="f">${t('note')}<input type="text" value="${esc(s.note || '')}" data-c="snote" data-s="${s.id}"></label></div>
      <div class="muted" style="margin-bottom:6px">${t('attendees')} (${s.attendeeIds.length})</div>
      <div class="chips">${members.map(chip).join('')}${guests.map(chip).join('')}<button class="chip" data-a="addGuest" data-s="${s.id}">${icon('plus')} ${t('guest')}</button></div></div>
    ${s.date > todayStr() ? `<p class="muted">${t('session.planned')}</p>` : ''}
    ${blocksHtml('s:' + s.id)}
    <div class="row end"><button class="btn ghost-danger" data-a="delSession" data-s="${s.id}">${icon('trash')} ${t('session.delete')}</button></div>`;
  return { html: header(fmtLong(s.date), { back: g ? `/group/${g.id}/sessions` : '/', sub: g ? g.name : '' }) + `<div class="page wide">${body}</div>` };
};
C.sdate = (v, d) => { if (!v) return; getSession(d.s).date = v; save(); render(); };
C.snote = (v, d) => { getSession(d.s).note = v.trim(); save(); };
A.toggleAtt = d => {
  const s = getSession(d.s), i = s.attendeeIds.indexOf(d.t);
  if (i >= 0) s.attendeeIds.splice(i, 1); else s.attendeeIds.push(d.t);
  syncEntries(s); save(); render();
};
A.delSession = d => confirmBox(t('session.delq'), t('delete'), () => {
  const s = getSession(d.s); const gid = s.groupId;
  deleteSessionData([s.id]); save(); navigate('/group/' + gid + '/sessions');
});
A.addGuest = d => {
  const s = getSession(d.s);
  const others = db.trainees.filter(x => x.active !== false && !s.attendeeIds.includes(x.id)).sort(byName);
  openSheet(`<h2>${t('guest')}</h2><div class="pick-res">${others.map(x => `<button class="btn" data-a="guestPick" data-s="${s.id}" data-t="${x.id}">${esc(x.name)}</button>`).join('') || `<p class="muted">${t('pick.none')}</p>`}</div>
    <form data-f="guestNew" data-s="${s.id}"><label class="f">${t('guest.new')}<input type="text" name="name" autocomplete="off"></label><div class="row end"><button type="button" class="btn" data-a="closeSheet">${t('cancel')}</button><button class="btn primary">${t('save')}</button></div></form>`);
};
A.guestPick = d => { const s = getSession(d.s); s.attendeeIds.push(d.t); syncEntries(s); save(); closeSheet(); render(); };
F.guestNew = (fd, d) => {
  const name = String(fd.get('name') || '').trim();
  if (!name) return;
  const tr = { id: uid(), name, note: '', active: true };
  db.trainees.push(tr);
  const s = getSession(d.s); s.attendeeIds.push(tr.id); syncEntries(s); save(); closeSheet(); render();
};

// ----- setting a trainee's stage -----
A.stage = d => {
  const s = getSession(d.s), tr = getTrainee(d.t), e = getEntry(s.id, d.t, d.k), lad = ladder(d.k), prev = prevEntry(s, d.t, d.k);
  const steps = lad.map((st, i) => `<button class="step ${e.progId === st.id ? 'on' : ''} ${prev && prev.progId === st.id ? 'was' : ''}" data-a="stageSet" data-s="${s.id}" data-t="${tr.id}" data-k="${esc(d.k)}" data-id="${st.id}"><span class="si">${i + 1}</span>${esc(st.label)}${prev && prev.progId === st.id ? `<em>${t('last')}</em>` : ''}</button>`).join('');
  openSheet(`<h2>${esc(tr.name)} · ${esc(exName(d.k))}</h2>${prev ? `<p class="muted">${t('last')}: ${esc(entryLabel(prev))}</p>` : ''}
    ${lad.length ? `<div class="ladder">${steps}</div>` : `<p class="muted">${t('stage.noladder')}</p>`}
    <form data-f="stageText" data-s="${s.id}" data-t="${tr.id}" data-k="${esc(d.k)}"><label class="f">${t('stage.free')}<input type="text" name="text" value="${esc(e.text || '')}" placeholder="${t('stage.free.ph')}" ${lad.length ? '' : 'autofocus'} autocomplete="off"></label>
    <div class="row between"><button type="button" class="btn ghost-danger" data-a="stageClear" data-s="${s.id}" data-t="${tr.id}" data-k="${esc(d.k)}">${t('stage.clear')}</button><span class="row"><button type="button" class="btn" data-a="closeSheet">${t('cancel')}</button><button class="btn primary">${t('save')}</button></span></div></form>`);
};
const applyStep = (e, st) => { delete e.text; e.progId = st.id; e.label = st.label; };
A.stageSet = d => {
  const e = getEntry(d.s, d.t, d.k), st = ladder(d.k).find(x => x.id === d.id);
  applyStep(e, st); save(); closeSheet(); render();
};
F.stageText = (fd, d) => {
  const e = getEntry(d.s, d.t, d.k), text = String(fd.get('text') || '').trim();
  if (!text) { closeSheet(); return; }
  delete e.progId; delete e.label; e.text = text; save(); closeSheet(); render();
};
A.stageClear = d => {
  const e = getEntry(d.s, d.t, d.k);
  delete e.progId; delete e.label; delete e.text; save(); closeSheet(); render();
};
A.nextStep = d => {
  const e = getEntry(d.s, d.t, d.k), lad = ladder(d.k);
  const i = e.progId ? lad.findIndex(x => x.id === e.progId) : -1;
  if (i + 1 >= lad.length) return;
  applyStep(e, lad[i + 1]); save(); render();
};
C.reps = (v, d) => { getEntry(d.s, d.t, d.k).reps = v.trim(); save(); };

// ----- block briefing: who does which progression -----
V.brief = ([sid, bid]) => {
  const s = getSession(sid), b = s && s.blocks.find(x => x.id === bid);
  if (!b) return notFound();
  const bi = s.blocks.indexOf(b);
  const people = s.attendeeIds.map(getTrainee).filter(Boolean);
  const items = b.items.map(it => {
    const key = ek(it);
    const list = people.map(tr => {
      const e = getEntry(s.id, tr.id, key), h = history(tr.id, key);
      return { t: tr, e, streak: e && isSet(e) ? streakAt(h, h.findIndex(x => x.e === e)) : null };
    });
    const { groups, none } = groupByStage(list, key);
    return `<section class="brief-item"><h2>${esc(itemName(it))}</h2><div class="muted">${t('rounds')}: ${b.rounds}</div>
      ${groups.map(gr => `<div class="bgroup"><div class="bg-l">${esc(gr.label)} <span class="tag">${gr.items.length}</span></div><div class="bg-n">${gr.items.map(personHtml).join('')}</div></div>`).join('')}
      ${none.length ? `<div class="bgroup none"><div class="bg-l">${t('nodata')}</div><div class="bg-n">${none.map(x => `<span>${esc(x.t.name)}</span>`).join('')}</div></div>` : ''}</section>`;
  }).join('');
  const link = i => {
    const o = s.blocks[i];
    if (!o) return '<span></span>';
    const href = o.type === 'strength' ? `#/brief/${s.id}/${o.id}` : `#/timer/s/${s.id}/${o.id}`;
    return `<a class="btn" href="${href}">${i < bi ? icon('left') + ' ' : ''}${i + 1}. ${t(o.type === 'strength' ? 'block.strength' : 'block.interval')}${i > bi ? ' ' + icon('next') : ''}</a>`;
  };
  return { html: header(`${bi + 1}. ${t('block.strength')}`, { back: '/session/' + s.id, sub: fmtLong(s.date) }) + `<div class="page">${items || `<p class="muted">${t('block.empty')}</p>`}<div class="step-nav">${link(bi - 1)}${link(bi + 1)}</div></div>` };
};
