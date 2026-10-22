# Edzéskövető / Workout Tracker

Progression tracker for group calisthenics training and personal training. No server, works offline.

## Use it
- **Hosted (recommended):** https://vargamv.github.io/workout-program/ — once GitHub Pages is enabled (see below).
  Open it on the phone and use the browser's *Add to Home Screen*; it then starts like an app and works offline.
- **Single file:** `dist/index.html` also works on its own (open it in a browser, or send it to someone).

Data lives in the browser that opened the app. Use *Settings → Export* for backups and *Import* to move data
(for example from the single-file version to the hosted one, or to another device).

## Enabling GitHub Pages (one-time)
1. Pages on a private repository needs a paid GitHub plan; on a free plan make the repository public
   (*Settings → General → Danger Zone → Change visibility*). Only code is in the repository, never your data.
2. *Settings → Pages → Build and deployment → Source:* **GitHub Actions**.
3. Publishing happens from the **`main`** branch: every push to `main` redeploys (or run the workflow by hand from the *Actions* tab).
   Development happens on other branches and is merged into `main` when ready.

## Develop
Sources are in `src/` (plain HTML/CSS/JS, no dependencies). `node build.js` regenerates `dist/` (the inlined
`index.html` plus the manifest, icons and offline cache used by the hosted version).

See `PLAN.md` for the design and data model.
