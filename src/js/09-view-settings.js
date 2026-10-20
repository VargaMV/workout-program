V.settings = () => {
  const s = db.settings;
  const seg = (name, opts, cur) => `<div class="seg">${opts.map(([v, l]) => `<button class="${cur === v ? 'on' : ''}" data-a="set" data-name="${name}" data-v="${v}">${l}</button>`).join('')}</div>`;
  const body = `<div class="card"><label class="f">${t('set.lang')}</label>${seg('lang', [['hu', 'Magyar'], ['en', 'English']], s.lang)}</div>
    <div class="card"><label class="f">${t('set.theme')}</label>${seg('theme', [['auto', t('theme.auto')], ['light', t('theme.light')], ['dark', t('theme.dark')]], s.theme)}</div>
    <div class="card"><label class="f">${t('set.threshold')}<input type="number" inputmode="numeric" min="0" max="50" value="${s.threshold}" data-c="threshold"></label><p class="muted">${t('set.threshold.help')}</p></div>
    <div class="card"><h2>${t('set.data')}</h2><p class="muted">${t('set.data.help')}</p>
      <p class="muted">${s.lastBackup ? t('set.lastbackup', { d: fmtDate(s.lastBackup) }) : t('backup.never')}</p>
      <div class="row"><button class="btn primary" data-a="export">${t('export')}</button><button class="btn" data-a="import">${t('import')}</button><button class="btn ghost-danger" data-a="wipe">${t('set.wipe')}</button></div></div>`;
  return { html: header(t('nav.settings')) + `<div class="page">${body}</div>` };
};
A.set = d => { db.settings[d.name] = d.v; save(); if (d.name === 'theme') applyTheme(); render(); };
C.threshold = v => { db.settings.threshold = num(v, 4, 0, 50); save(); };
A.export = exportData;
A.import = () => { const f = $('#importFile'); f.value = ''; f.click(); };
C.importFile = (v, d, el) => {
  const f = el.files && el.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => confirmBox(t('import.q'), t('import'), () => { if (importData(String(r.result))) { applyTheme(); render(); toast(t('import.ok')); } else toast(t('import.bad')); }, false);
  r.readAsText(f);
};
A.wipe = () => confirmBox(t('set.wipe.q'), t('set.wipe'), () => { db = DEFAULTS(); save(); applyTheme(); navigate('/'); render(); });
