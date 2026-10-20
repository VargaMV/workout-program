// Workout planner: pick today's exercises from the group's template and split them into blocks with one tap each.
const lastDoneSession = gid => {
  const ss = db.sessions.filter(s => s.groupId === gid).sort(sessionCmp);
  return [...ss].reverse().find(s => s.date <= todayStr()) || ss[ss.length - 1];
};
const lastIntervalBlock = gid => {
  for (const s of db.sessions.filter(x => x.groupId === gid).sort(sessionCmp).reverse()) {
    const b = s.blocks.find(x => x.type === 'interval');
    if (b) return b;
  }
  return null;
};
const planPool = () => {
  const tp = getTemplate(ui.plan.tplId);
  const base = tp ? tp.exIds : [];
  return [...base, ...ui.plan.extra.filter(x => !base.includes(x))].filter(getExercise);
};
// First block (1, 2, 3, ...) that still has room for another exercise (3 per block).
function planAutoGroup() {
  const cnt = {};
  for (const v of Object.values(ui.plan.assign)) if (v) cnt[v] = (cnt[v] || 0) + 1;
  let n = 1;
  while ((cnt[n] || 0) >= 3) n++;
  return n;
}
function planPut(id, n) {
  const P = ui.plan;
  P.assign[id] = n;
  if (!n) P.order = P.order.filter(x => x !== id);
  else if (!P.order.includes(id)) P.order.push(id);
}

V.plan = ([gid]) => {
  const g = getGroup(gid);
  if (!g) return notFound();
  if (!ui.plan || ui.plan.gid !== gid) {
    ui.plan = { gid, tplId: g.templateId || '', date: todayStr(), assign: {}, order: [], extra: [], rounds: {}, interval: !!lastIntervalBlock(gid) };
    onLeave(() => { ui.plan = null; });
  }
  const P = ui.plan, tp = getTemplate(P.tplId), pool = planPool();
  const used = Object.values(P.assign).filter(Boolean);
  const maxG = Math.min(6, Math.max(3, (used.length ? Math.max(...used) : 0) + 1));
  const rows = pool.map(id => {
    const n = P.assign[id] || 0;
    const extra = !(tp && tp.exIds.includes(id));
    return `<div class="plan-row ${n ? 'on' : ''}"><button class="plan-name" data-a="planTap" data-id="${id}"><span class="pn-n">${n || ''}</span><span>${esc(exName(id))}${extra ? `<span class="tag">${t('plan.extra')}</span>` : ''}</span></button>
      <div class="seg">${Array.from({ length: maxG + 1 }, (_, k) => `<button class="${n === k ? 'on' : ''}" data-a="planSet" data-id="${id}" data-n="${k}">${k || '–'}</button>`).join('')}</div></div>`;
  }).join('');
  const nums = [...new Set(used)].sort((a, b) => a - b);
  const summary = nums.map((n, i) => `<div><b>${t('plan.block', { n: i + 1 })}</b> ${P.order.filter(x => P.assign[x] === n).map(x => esc(exName(x))).join(', ')}</div>`).join('');
  const opts = [...db.templates].sort(byName).map(x => `<option value="${x.id}" ${x.id === P.tplId ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
  const body = `<div class="card"><div class="fields"><label class="f">${t('date')}<input type="date" value="${P.date}" data-c="planDate"></label>
      <label class="f">${t('plan.tpl')}<select data-c="planTpl"><option value="">${t('tpl.none')}</option>${opts}</select></label></div>
      ${(P.tplId || '') !== (g.templateId || '') && P.tplId ? `<button class="link-btn" data-a="planTplSave">${t('plan.tpl.save')}</button>` : ''}
      <div class="join"><button class="btn" data-a="planLast">${t('plan.last')}</button><button class="btn" data-a="planSplit">${t('plan.split')}</button><button class="btn" data-a="planClear">${t('plan.clear')}</button></div>
      <p class="muted" style="margin:0">${t('plan.help')}</p></div>
    ${pool.length ? `<div class="plan-list">${rows}</div>` : `<p class="muted">${tp ? t('plan.emptypool') : t('plan.notpl')}</p>`}
    <button class="btn full" data-a="planAdd">${icon('plus')} ${t('plan.add')}</button>
    ${summary ? `<div class="card plan-sum">${summary}</div>` : ''}
    <div class="plan-bar"><span class="muted">${t('plan.sum', { b: nums.length, n: used.length })}</span>
      <label class="check"><input type="checkbox" data-c="planInterval" ${P.interval ? 'checked' : ''}> ${t('plan.interval')}</label>
      <button class="btn primary" data-a="planCreate">${t('plan.create')}</button></div>`;
  return { html: header(t('plan.title'), { back: `/group/${gid}/sessions`, sub: g.name }) + `<div class="page">${body}</div>` };
};

A.planTap = ({ id }) => { planPut(id, ui.plan.assign[id] ? 0 : planAutoGroup()); render(); };
A.planSet = ({ id, n }) => { planPut(id, +n); render(); };
A.planClear = () => { ui.plan.assign = {}; ui.plan.order = []; render(); };
// Spread the chosen exercises evenly over blocks of about 3 (8 -> 3+3+2, 9 -> 3+3+3).
A.planSplit = () => {
  const P = ui.plan, list = P.order.filter(x => P.assign[x]), n = list.length;
  if (!n) { toast(t('plan.none')); return; }
  const gn = Math.ceil(n / 3), base = Math.floor(n / gn), rem = n % gn;
  let i = 0;
  for (let gi = 0; gi < gn; gi++) for (let k = 0; k < base + (gi < rem ? 1 : 0); k++) P.assign[list[i++]] = gi + 1;
  render();
};
A.planLast = () => {
  const P = ui.plan, s = lastDoneSession(P.gid);
  if (!s) { toast(t('plan.nolast')); return; }
  P.assign = {}; P.order = []; P.rounds = {};
  let bi = 0;
  for (const b of s.blocks.filter(x => x.type === 'strength')) {
    bi++;
    for (const it of b.items) {
      if (!it.exId || !getExercise(it.exId)) continue;
      if (!planPool().includes(it.exId)) P.extra.push(it.exId);
      planPut(it.exId, bi);
    }
    P.rounds[bi] = b.rounds;
  }
  P.interval = s.blocks.some(x => x.type === 'interval') || !!lastIntervalBlock(P.gid);
  render();
};
A.planAdd = () => openPicker({
  title: t('plan.add'), allowText: false, allowNew: true, kinds: 'strength',
  have: () => new Set(planPool()),
  add: ids => {
    for (const id of ids) {
      if (!planPool().includes(id)) ui.plan.extra.push(id);
      if (!ui.plan.assign[id]) planPut(id, planAutoGroup());
    }
    render();
  },
});
C.planTpl = v => {
  const P = ui.plan;
  P.tplId = v;
  // exercises already chosen but not in the new template stay available as extras
  for (const id of Object.keys(P.assign)) if (P.assign[id] && !planPool().includes(id) && !P.extra.includes(id)) P.extra.push(id);
  render();
};
A.planTplSave = () => { getGroup(ui.plan.gid).templateId = ui.plan.tplId; save(); toast(t('plan.tpl.saved')); render(); };
C.planDate = v => { ui.plan.date = v || todayStr(); };
C.planInterval = v => { ui.plan.interval = v; };
A.planCreate = () => {
  const P = ui.plan, nums = [...new Set(Object.values(P.assign).filter(Boolean))].sort((a, b) => a - b);
  if (!nums.length) { toast(t('plan.none')); return; }
  const blocks = nums.map(n => ({
    id: uid(), type: 'strength', rounds: P.rounds[n] || 3,
    items: P.order.filter(x => P.assign[x] === n).map(x => ({ id: uid(), exId: x, name: exName(x) })),
  }));
  if (P.interval) {
    const ib = lastIntervalBlock(P.gid);
    blocks.push(ib ? { ...ib, id: uid(), items: ib.items.map(i => ({ ...i, id: uid() })) } : { id: uid(), type: 'interval', rounds: 3, work: 40, rest: 20, roundRest: 60, items: [] });
  }
  const grp = getGroup(P.gid);
  const s = { id: uid(), groupId: grp.id, date: P.date, created: Date.now(), attendeeIds: activeMembers(grp).map(x => x.id), blocks, note: '' };
  db.sessions.push(s);
  syncEntries(s); save();
  navigate('/session/' + s.id);
};
