// Home (groups), group page (matrix / sessions / template), exercise summary.
function streakChips(sk) {
  if (!sk || !sk.n) return '';
  const hot = sk.n >= db.settings.threshold;
  return `<span class="badge ${hot ? 'hot' : ''}" title="${esc(t('streak.tip'))}">×${sk.n}</span>` +
    (sk.exact < sk.n ? `<span class="badge ghost" title="${esc(t('exact.tip'))}">${t('exact', { n: sk.exact })}</span>` : '');
}

function backupBanner() {
  if (!db.trainees.length) return '';
  const lb = db.settings.lastBackup;
  const days = lb ? Math.floor((Date.now() - parseDate(lb).getTime()) / 864e5) : null;
  if (lb && days < 14) return '';
  return `<div class="banner"><span>${lb ? t('backup.old', { n: days }) : t('backup.never')}</span><button class="btn small" data-a="export">${t('export')}</button></div>`;
}

V.home = () => {
  const gs = [...db.groups].sort(byName);
  let body;
  if (!gs.length) {
    body = `<div class="empty-state"><h2>${t('home.empty.t')}</h2><p>${t('home.empty.p')}</p>
      <ol class="steps"><li>${t('home.s1')}</li><li>${t('home.s2')}</li><li>${t('home.s3')}</li></ol>
      <div class="row" style="justify-content:center"><button class="btn primary" data-a="newGroup">${t('group.new')}</button><a class="btn" href="#/manage/exercises">${t('home.openEx')}</a></div></div>`;
  } else {
    body = `<div class="cards">${gs.map(g => {
      const last = db.sessions.filter(s => s.groupId === g.id && s.date <= todayStr()).sort(sessionCmp).pop();
      return `<a class="card link" href="#/group/${g.id}"><div class="card-t">${esc(g.name)}</div><div class="muted">${t('n.members', { n: activeMembers(g).length })}${last ? ' · ' + t('last.session', { d: fmtDate(last.date) }) : ''}</div></a>`;
    }).join('')}</div><button class="btn" data-a="newGroup">${icon('plus')} ${t('group.new')}</button>`;
  }
  return { html: header(t('nav.groups')) + backupBanner() + `<div class="page">${body}</div>` };
};

A.newGroup = () => promptBox(t('group.new'), t('name'), '', name => {
  const g = { id: uid(), name, traineeIds: [], template: [] };
  db.groups.push(g); save(); navigate('/group/' + g.id + '/matrix');
});

V.group = ([id, tab = 'matrix']) => {
  const g = getGroup(id);
  if (!g) return notFound();
  const tabs = ['matrix', 'sessions', 'template'];
  const nav = `<nav class="tabs">${tabs.map(x => `<a class="${x === tab ? 'on' : ''}" href="#/group/${g.id}/${x}">${t('tab.' + x)}</a>`).join('')}</nav>`;
  const body = tab === 'sessions' ? sessionsTab(g) : tab === 'template' ? templateTab(g) : matrixTab(g);
  const actions = `<button class="icon-btn" data-a="editGroup" data-id="${g.id}" aria-label="${t('group.edit')}">${icon('edit')}</button><button class="btn primary" data-a="newSession" data-g="${g.id}">${icon('plus')}<span class="hide-s">${t('session.new')}</span></button>`;
  return { html: header(g.name, { back: '/', actions, sub: t('n.members', { n: activeMembers(g).length }) }) + nav + `<div class="page wide">${body}</div>` };
};

function cellHtml(tid, key) {
  const L = latest(tid, key);
  if (!L) return '<td class="empty">–</td>';
  const { e, s, streak } = L;
  const pl = planned(tid, key);
  const hot = streak.n >= db.settings.threshold;
  return `<td class="${hot ? 'hot' : ''}"><div class="st">${esc(entryLabel(e))}</div>
    <div class="meta">${streakChips(streak)}</div>
    ${e.reps ? `<small>${esc(e.reps)}</small>` : ''}<small>${fmtDate(s.date)}</small>
    ${pl && !sameExact(pl, e) ? `<div class="next">→ ${esc(entryLabel(pl))}${pl.reps ? ' · ' + esc(pl.reps) : ''}</div>` : ''}</td>`;
}

function matrixTab(g) {
  const ms = activeMembers(g);
  if (!ms.length) return `<div class="empty-state"><p>${t('matrix.nomembers')}</p><button class="btn primary" data-a="editGroup" data-id="${g.id}">${t('group.edit')}</button></div>`;
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
  return `<div class="cards">${ss.map(s => `<a class="card link" href="#/session/${s.id}"><div class="card-t">${fmtLong(s.date)}${s.date > todayStr() ? `<span class="tag">${t('planned')}</span>` : ''}</div><div class="muted">${t('n.attendees', { n: s.attendeeIds.length })} · ${t('n.blocks', { n: s.blocks.length })}</div></a>`).join('')}</div>`;
}

function templateTab(g) {
  g.template = g.template || [];
  return `<p class="muted">${t('template.help')}</p>${blocksHtml('t:' + g.id)}`;
}

A.newSession = ({ g }) => {
  const grp = getGroup(g);
  const s = { id: uid(), groupId: g, date: todayStr(), created: Date.now(), attendeeIds: activeMembers(grp).map(x => x.id), blocks: cloneBlocks(grp.template || []), note: '' };
  db.sessions.push(s);
  syncEntries(s); save();
  navigate('/session/' + s.id);
};

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

function personHtml(it) {
  return `<span class="pn"><a href="#/trainee/${it.t.id}">${esc(it.t.name)}</a>${streakChips(it.streak)}${it.e && it.e.reps ? `<small>${esc(it.e.reps)}</small>` : ''}</span>`;
}
