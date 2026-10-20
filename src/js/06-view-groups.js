// Home (groups), group page (matrix / sessions / template), exercise summary.
// "5/2" = 5th session on this progression, 2nd in a row with the same reps and weight.
const streakLabel = sk => `${sk.n}/${sk.exact}`;
function streakChips(sk) {
  if (!sk || sk.n < 2) return '';
  return `<span class="badge ${sk.n >= db.settings.threshold ? 'hot' : ''}" title="${esc(t('streak.tip'))}">${streakLabel(sk)}</span>`;
}

function backupBanner() {
  if (!db.trainees.length) return '';
  const lb = db.settings.lastBackup;
  const days = lb ? Math.floor((Date.now() - parseDate(lb).getTime()) / 864e5) : null;
  if (lb && days < 14) return '';
  return `<div class="banner"><span>${lb ? t('backup.old', { n: days }) : t('backup.never')}</span><button class="btn small" data-a="export">${t('export')}</button></div>`;
}

V.home = () => {
  const all = [...db.groups].sort(byName), gs = all.filter(g => !g.solo), ps = all.filter(g => g.solo);
  const lastOf = g => db.sessions.filter(x => x.groupId === g.id && x.date <= todayStr()).sort(sessionCmp).pop();
  const cards = list => `<div class="cards">${list.map(g => {
    const last = lastOf(g), m = g.solo ? activeMembers(g)[0] : null;
    const sub = [g.solo ? '' : t('n.members', { n: activeMembers(g).length }), last ? t('last.session', { d: fmtDate(last.date) }) : ''].filter(Boolean).join(' · ');
    return `<a class="card link" href="#/group/${g.id}"><div class="card-t">${esc(g.name)}</div>${sub ? `<div class="muted">${sub}</div>` : ''}${m && m.note ? `<div class="muted warn-note">${esc(m.note)}</div>` : ''}</a>`;
  }).join('')}</div>`;
  const buttons = `<div class="join"><button class="btn" data-a="newGroup">${icon('plus')} ${t('group.new')}</button><button class="btn" data-a="newPerson">${icon('plus')} ${t('person.new')}</button></div>`;
  let body;
  if (!all.length) {
    body = `<div class="empty-state"><h2>${t('home.empty.t')}</h2><p>${t('home.empty.p')}</p>
      <ol class="steps"><li>${t('home.s1')}</li><li>${t('home.s2')}</li><li>${t('home.s3')}</li></ol></div>${buttons}
      <a class="btn full" href="#/manage/exercises">${t('home.openEx')}</a>`;
  } else {
    body = `${gs.length ? `<h3 class="sect-h">${t('nav.groups')}</h3>${cards(gs)}` : ''}${ps.length ? `<h3 class="sect-h">${t('solo.title')}</h3>${cards(ps)}` : ''}${buttons}`;
  }
  return { html: header(t('nav.groups')) + backupBanner() + `<div class="page">${body}</div>` };
};

A.newGroup = () => promptBox(t('group.new'), t('name'), '', name => {
  const g = { id: uid(), name, traineeIds: [] };
  db.groups.push(g); save(); navigate('/group/' + g.id + '/matrix');
});

V.group = ([id, tab = 'matrix']) => {
  const g = getGroup(id);
  if (!g) return notFound();
  const tabs = g.solo ? ['matrix', 'sessions', 'template'] : ['matrix', 'sessions', 'members', 'template'];
  if (!tabs.includes(tab)) tab = 'matrix';
  const nav = `<nav class="tabs">${tabs.map(x => `<a class="${x === tab ? 'on' : ''}" href="#/group/${g.id}/${x}">${t('tab.' + x)}</a>`).join('')}</nav>`;
  const body = tab === 'sessions' ? sessionsTab(g) : tab === 'template' ? templateTab(g) : tab === 'members' ? membersTab(g) : g.solo ? soloOverview(g) : matrixTab(g);
  const actions = `<button class="icon-btn" data-a="${g.solo ? 'editPerson' : 'editGroup'}" data-id="${g.id}" aria-label="${t('group.edit')}">${icon('edit')}</button><button class="btn primary" data-a="newSession" data-g="${g.id}">${icon('plus')}<span class="hide-s">${t('session.new')}</span></button>`;
  return { html: header(g.name, { back: '/', actions, sub: g.solo ? t('solo.title') : t('n.members', { n: activeMembers(g).length }) }) + nav + `<div class="page wide">${body}</div>` };
};

function cellHtml(tid, key) {
  const L = latest(tid, key);
  if (!L) return '<td class="empty">–</td>';
  const { e, s, streak } = L;
  const pl = planned(tid, key);
  const hot = streak.n >= db.settings.threshold;
  const info = [esc(extraText(e, true)), fmtDate(s.date)].filter(Boolean).join(' · ');
  return `<td class="${hot ? 'hot' : ''}">${streak.n > 1 ? `<span class="badge corner ${hot ? 'hot' : ''}" title="${esc(t('streak.tip'))}">${streakLabel(streak)}</span>` : ''}<div class="st ${streak.n > 1 ? 'pad' : ''}">${esc(entryLabel(e))}</div>
    <small>${info}</small>
    ${pl && !sameExact(pl, e) ? `<div class="next">→ ${esc(entryLabel(pl))}${extraText(pl, true) ? ' · ' + esc(extraText(pl, true)) : ''}</div>` : ''}</td>`;
}

function matrixTab(g) {
  const ms = activeMembers(g);
  if (!ms.length) return `<div class="empty-state"><p>${t('matrix.nomembers')}</p><a class="btn primary" href="#/group/${g.id}/members">${t('tab.members')}</a></div>`;
  const { main, extra } = groupColumns(g);
  const all = (ui.showAll || {})[g.id] || !main.length;
  const cols = all ? [...main, ...extra] : main;
  if (!cols.length) return `<div class="empty-state"><p>${t('matrix.nocols')}</p><a class="btn" href="#/group/${g.id}/template">${t('tab.template')}</a></div>`;
  const head = cols.map(c => `<th><a href="#/exsum/${g.id}/${encodeURIComponent(c.key)}">${esc(exName(c.key))}</a></th>`).join('');
  const rows = ms.map(m => `<tr><th class="stick"><a href="#/trainee/${m.id}">${esc(m.name)}</a>${m.note ? `<small class="warn-note">${esc(m.note)}</small>` : ''}</th>${cols.map(c => cellHtml(m.id, c.key)).join('')}</tr>`).join('');
  return `${main.length && extra.length ? `<label class="check"><input type="checkbox" data-c="showAll" data-g="${g.id}" ${all ? 'checked' : ''}> ${t('matrix.all')}</label>` : ''}
    <div class="matrix-wrap"><table class="matrix"><thead><tr><th class="stick"></th>${head}</tr></thead><tbody>${rows}</tbody></table></div>
    <p class="muted" style="margin-top:10px">${t('matrix.legend')}</p>`;
}
C.showAll = (v, d) => { (ui.showAll = ui.showAll || {})[d.g] = v; render(); };

function sessionsTab(g) {
  const ss = db.sessions.filter(s => s.groupId === g.id).sort(sessionCmp).reverse();
  if (!ss.length) return `<div class="empty-state"><p>${t('sessions.empty')}</p><button class="btn primary" data-a="newSession" data-g="${g.id}">${t('session.new')}</button></div>`;
  return `<div class="cards">${ss.map(s => `<div class="card sess"><a class="sess-main" href="#/session/${s.id}/program"><div class="card-t">${fmtLong(s.date)}${s.date > todayStr() ? `<span class="tag">${t('planned')}</span>` : ''}</div><div class="muted">${g.solo ? '' : t('n.attendees', { n: s.attendeeIds.length }) + ' · '}${t('n.blocks', { n: s.blocks.length })}</div></a>
    <div class="sess-btns"><a class="btn small" href="#/session/${s.id}/program">${t('tab.program')}</a><a class="btn small" href="#/session/${s.id}/log">${t('tab.log')}</a></div></div>`).join('')}</div>`;
}

// Personal training: one person, so the overview is a list of exercises instead of a one-row matrix.
function soloOverview(g) {
  const m = activeMembers(g)[0];
  if (!m) return `<div class="empty-state"><p>${t('matrix.nomembers')}</p></div>`;
  const { main, extra } = groupColumns(g);
  const keys = [...main, ...extra].map(c => c.key);
  if (!keys.length) return `<div class="empty-state"><p>${t('matrix.nocols')}</p><a class="btn" href="#/group/${g.id}/template">${t('tab.template')}</a></div>`;
  const rows = keys.map(k => {
    const L = latest(m.id, k), pl = L && planned(m.id, k), path = stagePath(m.id, k);
    const hot = L && L.streak.n >= db.settings.threshold;
    const detail = L ? [extraText(L.e, true), fmtDate(L.s.date)].filter(Boolean).join(' · ') : '';
    return `<div class="srow ${hot ? 'hot' : ''}"><div class="srow-h"><span class="srow-n">${esc(exName(k))}</span>${L ? `<span class="srow-s">${esc(entryLabel(L.e))}${L.streak.n > 1 ? ` <span class="badge ${hot ? 'hot' : ''}" title="${esc(t('streak.tip'))}">${streakLabel(L.streak)}</span>` : ''}</span>` : `<span class="muted">–</span>`}</div>
      ${L ? `<div class="muted">${esc(detail)}${pl && !sameExact(pl, L.e) ? ` · <span class="next-inline">→ ${esc(entryLabel(pl))}${extraText(pl, true) ? ' · ' + esc(extraText(pl, true)) : ''}</span>` : ''}</div>` : ''}
      ${path.length > 1 ? `<div class="path">${path.map((p, i) => `${i ? '<span class="a">→</span>' : ''}<span class="p">${esc(entryLabel(p.e))} (${p.n})</span>`).join('')}</div>` : ''}</div>`;
  }).join('');
  return `<div class="row between"><span class="muted">${m.note ? `<span class="warn-note">${esc(m.note)}</span>` : ''}</span><a class="btn small" href="#/trainee/${m.id}">${t('trainee.history')}</a></div><div class="rows solo">${rows}</div>
    <p class="muted">${t('matrix.legend')}</p>`;
}

function membersTab(g) {
  const ms = activeMembers(g);
  const rows = ms.map(x => `<button class="list-row" data-a="editTrainee" data-id="${x.id}" data-g="${g.id}"><span class="grow"><b>${esc(x.name)}</b>${x.note ? `<div class="muted warn-note">${esc(x.note)}</div>` : ''}</span>${icon('edit')}</button>`).join('');
  const hasOthers = db.trainees.some(x => !g.traineeIds.includes(x.id));
  return `<div class="rows">${rows || `<p class="muted">${t('matrix.nomembers')}</p>`}</div>
    <button class="btn primary full" data-a="editTrainee" data-g="${g.id}">${icon('plus')} ${t('member.new')}</button>
    ${hasOthers ? `<button class="btn full" data-a="addMember" data-g="${g.id}">${icon('plus')} ${t('member.addExisting')}</button>` : ''}`;
}

function templateTab(g) {
  const tp = getTemplate(g.templateId);
  const opts = [...db.templates].sort(byName).map(x => `<option value="${x.id}" ${x.id === g.templateId ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
  return `<div class="card"><label class="f">${t('tpl.current')}<select data-c="grpTpl" data-g="${g.id}"><option value="">${t('tpl.none')}</option>${opts}</select></label>
    ${tp ? `<div class="chips">${tp.exIds.filter(getExercise).map(x => `<span class="tag">${esc(exName(x))}</span>`).join('')}</div>` : ''}
    <div class="row">${tp ? `<a class="btn small" href="#/template/${tp.id}">${t('tpl.edit')}</a><button class="btn small" data-a="tplCopy" data-g="${g.id}">${t('tpl.copy')}</button>` : ''}<button class="btn small" data-a="tplNewFor" data-g="${g.id}">${t('tpl.new')}</button></div></div>
    <p class="muted">${t('tpl.help')}</p>`;
}
C.grpTpl = (v, d) => { const g = getGroup(d.g); if (v) g.templateId = v; else delete g.templateId; save(); render(); };
A.tplCopy = ({ g }) => {
  const grp = getGroup(g), tp = getTemplate(grp.templateId);
  promptBox(t('tpl.copy'), t('name'), tp.name, name => {
    const n = { id: uid(), name, exIds: [...tp.exIds] };
    db.templates.push(n); grp.templateId = n.id; save(); render(); toast(t('tpl.copied'));
  });
};
A.tplNewFor = ({ g }) => promptBox(t('tpl.new'), t('name'), '', name => {
  const n = { id: uid(), name, exIds: [] };
  db.templates.push(n); getGroup(g).templateId = n.id; save(); navigate('/template/' + n.id);
});

A.newSession = ({ g }) => navigate('/plan/' + g);

V.exsum = ([gid, key]) => {
  const g = getGroup(gid);
  if (!g || !key) return notFound();
  const ms = activeMembers(g);
  const list = ms.map(m => { const L = latest(m.id, key); return { t: m, e: L && L.e, streak: L && L.streak }; });
  const { groups, none } = groupByStage(list, key);
  const body = groups.map(gr => `<div class="bgroup"><div class="bg-l">${esc(gr.label)} <span class="tag">${gr.items.length}</span></div><div class="bg-n">${gr.items.map(it => personHtml(it)).join('')}</div></div>`).join('') +
    (none.length ? `<div class="bgroup none"><div class="bg-l">${t('nodata')}</div><div class="bg-n">${none.map(it => `<span>${esc(it.t.name)}</span>`).join('')}</div></div>` : '');
  const edit = getExercise(key) ? `<a class="btn small" href="#/exercise/${key}">${t('ex.edit')}</a>` : '';
  return { html: header(exName(key), { back: `/group/${g.id}/matrix`, sub: g.name, actions: edit }) + `<div class="page"><div class="brief-item">${body || `<p class="muted">${t('nodata')}</p>`}</div></div>` };
};

// short: the block's rounds are already announced, so only the reps are shown ("5db").
function personHtml(it, short) {
  const detail = it.e ? extraText(it.e, short) : '';
  return `<span class="pn"><a href="#/trainee/${it.t.id}">${esc(it.t.name)}</a>${streakChips(it.streak)}${detail ? `<small>${esc(detail)}</small>` : ''}${it.e && it.e.note ? `<small class="note">“${esc(it.e.note)}”</small>` : ''}</span>`;
}
