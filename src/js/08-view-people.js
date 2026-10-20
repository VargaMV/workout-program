// Trainee profile, manage (trainees / groups / exercises), exercise editor.
V.trainee = ([id]) => {
  const tr = getTrainee(id);
  if (!tr) return notFound();
  const today = todayStr();
  const groups = db.groups.filter(g => g.traineeIds.includes(id));
  const mine = db.entries.filter(e => e.traineeId === id && isSet(e) && getSession(e.sessionId));
  const attended = db.sessions.filter(s => s.attendeeIds.includes(id) && s.date <= today).sort(sessionCmp).reverse();
  const keys = [...new Set(mine.map(e => e.ek))].sort((a, b) => exName(a).localeCompare(exName(b), locale()));
  const rows = keys.map(k => {
    const L = latest(id, k), h = history(id, k).slice().reverse();
    const path = [];
    for (const x of h) {
      const last = path[path.length - 1];
      if (last && sameStage(last.e, x.e)) last.n++; else path.push({ e: x.e, n: 1 });
    }
    return `<div class="card"><div class="row between" style="margin:0"><div class="card-t">${esc(exName(k))}</div>${L ? `<div>${esc(entryLabel(L.e))} ${streakChips(L.streak)}</div>` : ''}</div>
      <div class="path">${path.map((p, i) => `${i ? `<span class="a">→</span>` : ''}<span class="p">${esc(entryLabel(p.e))} ×${p.n}</span>`).join('')}</div></div>`;
  }).join('');
  const days = attended.map(s => {
    const es = db.entries.filter(e => e.sessionId === s.id && e.traineeId === id && isSet(e));
    return `<div class="tl-day"><div class="d"><a href="#/session/${s.id}">${fmtLong(s.date)}</a></div>${es.map(e => `<div class="tl-ent"><span>${esc(exName(e.ek))}</span><span>${esc(entryLabel(e))}${e.reps ? ' · ' + esc(e.reps) : ''}</span></div>`).join('') || `<div class="muted">${t('attended')}</div>`}</div>`;
  }).join('');
  const info = `<div class="card"><div class="muted">${groups.map(g => esc(g.name)).join(', ') || t('nogroup')} · ${t('n.sessions', { n: attended.length })}${tr.active === false ? ' · ' + t('archived') : ''}</div>${tr.note ? `<div class="warn-note" style="margin-top:6px">${esc(tr.note)}</div>` : ''}</div>`;
  return { html: header(tr.name, { back: groups[0] ? `/group/${groups[0].id}/matrix` : '/', actions: `<button class="icon-btn" data-a="editTrainee" data-id="${id}" aria-label="${t('edit')}">${icon('edit')}</button>` }) +
    `<div class="page"><div class="page-grid">${info}<h2>${t('trainee.progress')}</h2>${rows || `<p class="muted">${t('nodata')}</p>`}<h2 style="margin-top:18px">${t('trainee.history')}</h2><div class="card">${days || `<p class="muted">${t('nodata')}</p>`}</div></div></div>` };
};

// ---------- manage ----------
V.manage = ([tab = 'trainees']) => {
  const tabs = ['trainees', 'groups', 'exercises'];
  const nav = `<nav class="tabs">${tabs.map(x => `<a class="${x === tab ? 'on' : ''}" href="#/manage/${x}">${t('tab.' + x)}</a>`).join('')}</nav>`;
  let body;
  if (tab === 'groups') {
    body = `<div class="card list">${[...db.groups].sort(byName).map(g => `<button class="list-row" data-a="editGroup" data-id="${g.id}"><span class="grow"><b>${esc(g.name)}</b><div class="muted">${t('n.members', { n: activeMembers(g).length })}</div></span>${icon('edit')}</button>`).join('') || `<p class="muted">${t('nodata')}</p>`}</div>
      <button class="btn primary" data-a="newGroup">${icon('plus')} ${t('group.new')}</button>`;
  } else if (tab === 'exercises') {
    body = `<input type="search" data-i="exSearch" placeholder="${t('search')}" style="margin-bottom:12px"><div class="card list" id="exList">${exList('')}</div>
      <button class="btn primary" data-a="newExercise">${icon('plus')} ${t('ex.new')}</button>`;
  } else {
    body = `<div class="card list">${[...db.trainees].sort(byName).map(x => `<button class="list-row" data-a="editTrainee" data-id="${x.id}"><span class="grow"><b>${esc(x.name)}</b>${x.active === false ? `<span class="tag">${t('archived')}</span>` : ''}<div class="muted">${esc(db.groups.filter(g => g.traineeIds.includes(x.id)).map(g => g.name).join(', ') || t('nogroup'))}${x.note ? ' · ' + esc(x.note) : ''}</div></span>${icon('edit')}</button>`).join('') || `<p class="muted">${t('nodata')}</p>`}</div>
      <button class="btn primary" data-a="editTrainee">${icon('plus')} ${t('trainee.new')}</button>`;
  }
  return { html: header(t('nav.manage')) + nav + `<div class="page">${body}</div>` };
};
function exList(q) {
  const nq = norm(q);
  return [...db.exercises].filter(x => !nq || norm(x.name).includes(nq)).sort(byName).map(x => `<a class="list-row" href="#/exercise/${x.id}"><span class="grow"><b>${esc(x.name)}</b><span class="tag">${t('kind.' + x.kind)}</span>${x.kind === 'strength' ? `<div class="muted">${t('n.steps', { n: x.steps.length })}</div>` : ''}</span>${icon('edit')}</a>`).join('') || `<p class="muted">${t('nodata')}</p>`;
}
I.exSearch = v => { $('#exList').innerHTML = exList(v); };

A.editTrainee = ({ id }) => {
  const tr = id ? getTrainee(id) : { name: '', note: '', active: true };
  openSheet(`<h2>${id ? t('edit') : t('trainee.new')}</h2><form data-f="saveTrainee" data-id="${id || ''}">
    <label class="f">${t('name')}<input type="text" name="name" value="${esc(tr.name)}" required autofocus autocomplete="off"></label>
    <label class="f">${t('trainee.note')}<input type="text" name="note" value="${esc(tr.note || '')}" placeholder="${t('trainee.note.ph')}"></label>
    ${db.groups.length ? `<div class="muted">${t('tab.groups')}</div><div class="checklist">${[...db.groups].sort(byName).map(g => `<label class="check"><input type="checkbox" name="g" value="${g.id}" ${g.traineeIds.includes(id) ? 'checked' : ''}> ${esc(g.name)}</label>`).join('')}</div>` : ''}
    <label class="check"><input type="checkbox" name="active" ${tr.active !== false ? 'checked' : ''}> ${t('active')}</label>
    <div class="row between">${id ? `<button type="button" class="btn ghost-danger" data-a="delTrainee" data-id="${id}">${t('delete')}</button>` : '<span></span>'}<span class="row"><button type="button" class="btn" data-a="closeSheet">${t('cancel')}</button><button class="btn primary">${t('save')}</button></span></div></form>`);
};
F.saveTrainee = (fd, d) => {
  const name = String(fd.get('name') || '').trim();
  if (!name) return;
  let tr = d.id && getTrainee(d.id);
  if (!tr) { tr = { id: uid() }; db.trainees.push(tr); }
  tr.name = name; tr.note = String(fd.get('note') || '').trim(); tr.active = fd.get('active') === 'on';
  const gs = fd.getAll('g');
  db.groups.forEach(g => {
    const has = g.traineeIds.includes(tr.id), want = gs.includes(g.id);
    if (want && !has) g.traineeIds.push(tr.id);
    if (!want && has) g.traineeIds = g.traineeIds.filter(x => x !== tr.id);
  });
  save(); closeSheet(); render();
};
A.delTrainee = ({ id }) => confirmBox(t('trainee.delq'), t('delete'), () => { deleteTrainee(id); save(); if (parseRoute().name === 'trainee') navigate('/manage/trainees'); else render(); });

A.editGroup = ({ id }) => {
  const g = getGroup(id);
  const trs = db.trainees.filter(x => x.active !== false || g.traineeIds.includes(x.id)).sort(byName);
  openSheet(`<h2>${t('group.edit')}</h2><form data-f="saveGroup" data-id="${id}">
    <label class="f">${t('name')}<input type="text" name="name" value="${esc(g.name)}" required autocomplete="off"></label>
    <div class="muted">${t('group.members')}</div>
    <div class="checklist">${trs.map(x => `<label class="check"><input type="checkbox" name="m" value="${x.id}" ${g.traineeIds.includes(x.id) ? 'checked' : ''}> ${esc(x.name)}</label>`).join('') || `<p class="muted">${t('group.notrainees')}</p>`}</div>
    <div class="row between"><button type="button" class="btn ghost-danger" data-a="delGroup" data-id="${id}">${t('delete')}</button><span class="row"><button type="button" class="btn" data-a="closeSheet">${t('cancel')}</button><button class="btn primary">${t('save')}</button></span></div></form>
    <button class="link-btn" data-a="quickTrainee" data-id="${id}">${icon('plus')} ${t('trainee.new')}</button>`);
};
F.saveGroup = (fd, d) => {
  const g = getGroup(d.id), name = String(fd.get('name') || '').trim();
  if (!name) return;
  g.name = name; g.traineeIds = fd.getAll('m'); save(); closeSheet(); render();
};
A.quickTrainee = ({ id }) => promptBox(t('trainee.new'), t('name'), '', name => {
  const tr = { id: uid(), name, note: '', active: true };
  db.trainees.push(tr); getGroup(id).traineeIds.push(tr.id); save(); render();
  A.editGroup({ id });
});
A.delGroup = ({ id }) => confirmBox(t('group.delq'), t('delete'), () => { deleteGroup(id); save(); navigate('/'); render(); });

// ---------- exercise editor ----------
A.newExercise = () => promptBox(t('ex.new'), t('name'), '', name => {
  const ex = { id: uid(), name, kind: 'strength', steps: [] };
  db.exercises.push(ex); save(); navigate('/exercise/' + ex.id);
});

V.exercise = ([id]) => {
  const ex = getExercise(id);
  if (!ex) return notFound();
  const strength = ex.kind === 'strength';
  const steps = ex.steps.map((s, i) => `<div class="step-edit"><span class="n">${i + 1}</span><input type="text" value="${esc(s.label)}" data-c="stepLabel" data-id="${ex.id}" data-st="${s.id}"><span class="item-a">
    <button class="icon-btn sm" data-a="stepMove" data-id="${ex.id}" data-st="${s.id}" data-dir="-1" ${i === 0 ? 'disabled' : ''} aria-label="${t('up')}">${icon('up')}</button>
    <button class="icon-btn sm" data-a="stepMove" data-id="${ex.id}" data-st="${s.id}" data-dir="1" ${i === ex.steps.length - 1 ? 'disabled' : ''} aria-label="${t('down')}">${icon('down')}</button>
    <button class="icon-btn sm" data-a="stepDel" data-id="${ex.id}" data-st="${s.id}" aria-label="${t('delete')}">${icon('x')}</button></span></div>`).join('');
  const body = `<div class="card"><label class="f">${t('name')}<input type="text" value="${esc(ex.name)}" data-c="exName" data-id="${ex.id}"></label>
    <div class="muted" style="margin-bottom:6px">${t('ex.kind')}</div><div class="seg">${['strength', 'other'].map(k => `<button class="${ex.kind === k ? 'on' : ''}" data-a="exKind" data-id="${ex.id}" data-k="${k}">${t('kind.' + k)}</button>`).join('')}</div></div>
    ${strength ? `<div class="card"><h2>${t('ex.steps')}</h2><p class="muted">${t('ex.steps.help')}</p>${steps || `<p class="muted">${t('ex.nosteps')}</p>`}
      <form data-f="addStep" data-id="${ex.id}" class="row" style="flex-wrap:nowrap"><input type="text" name="label" placeholder="${t('ex.step.ph')}" autocomplete="off"><button class="btn primary">${icon('plus')}</button></form>
      <details><summary class="muted" style="cursor:pointer">${t('ex.bulk')}</summary><form data-f="addSteps" data-id="${ex.id}"><textarea name="labels" placeholder="${t('ex.bulk.ph')}"></textarea><div class="row end"><button class="btn">${t('ex.bulk.add')}</button></div></form></details></div>` : `<p class="muted">${t('ex.other.help')}</p>`}
    <div class="row end"><button class="btn ghost-danger" data-a="delExercise" data-id="${ex.id}">${icon('trash')} ${t('ex.delete')}</button></div>`;
  return { html: header(ex.name, { back: '/manage/exercises' }) + `<div class="page">${body}</div>` };
};
C.exName = (v, d) => { const n = v.trim(); if (n) { getExercise(d.id).name = n; save(); } else render(); };
A.exKind = d => { getExercise(d.id).kind = d.k; save(); render(); };
C.stepLabel = (v, d) => { const s = getExercise(d.id).steps.find(x => x.id === d.st); if (v.trim()) { s.label = v.trim(); save(); } else render(); };
A.stepMove = d => { const ex = getExercise(d.id); move(ex.steps, ex.steps.findIndex(s => s.id === d.st), +d.dir); save(); render(); };
A.stepDel = d => {
  const used = db.entries.filter(e => e.ek === d.id && e.progId === d.st).length;
  const go = () => { const ex = getExercise(d.id); ex.steps = ex.steps.filter(s => s.id !== d.st); save(); render(); };
  if (used) confirmBox(t('ex.stepdelq', { n: used }), t('delete'), go); else go();
};
F.addStep = (fd, d) => {
  const label = String(fd.get('label') || '').trim();
  if (!label) return;
  getExercise(d.id).steps.push({ id: uid(), label }); save(); render();
  const i = $('input[name=label]'); if (i) i.focus();
};
F.addSteps = (fd, d) => {
  String(fd.get('labels') || '').split('\n').map(x => x.trim()).filter(Boolean).forEach(label => getExercise(d.id).steps.push({ id: uid(), label }));
  save(); render();
};
A.delExercise = ({ id }) => confirmBox(t('ex.delq'), t('delete'), () => { db.exercises = db.exercises.filter(x => x.id !== id); save(); navigate('/manage/exercises'); });
