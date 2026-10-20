# Calisthenics progression tracker – plan

## Decisions so far
- Single-file webapp, vanilla HTML/CSS/JS (dev in `src/`, a small build script inlines into `dist/index.html`).
- Data in the browser (localStorage/IndexedDB), JSON export/import for backup and moving between devices. No backend for now.
- UI: Hungarian + English, switchable (all strings in a dictionary from day one, default HU).
- Theme: light + dark (system default, manual toggle), CSS variables.
- Starts empty (no seed data). Reps/notes are free text.
- Others may use it → everything is per-device, no hard-coded personal data.

## Data model
```
Exercise   { id, name, kind: 'strength'|'other', progressions: [{id,label}] }   // ladder, easy -> hard; 'other' has no ladder
Trainee    { id, name, note, active }
Group      { id, name, traineeIds[], template: Block[] }                          // usual workout, cloned into each new session
Session    { id, groupId, date, attendeeIds[], blocks: Block[] }
Block      { id, type: 'strength'|'interval', rounds, items: BlockItem[],         // ordered
             // interval only:
             workSec, restSec, roundRestSec }                                     // roundRestSec (Z) > restSec (Y), used after each full round
BlockItem  { id, exerciseId?|customName }                                         // any exercise, or free text
Entry      { sessionId, blockItemId, traineeId, progressionId?|freeText, note }   // strength items only
```
- Current stage = latest entry of that trainee for that exercise (no separate "current" field).
- Interval/cardio blocks have no per-trainee tracking; exercises are mostly ad-hoc names (autocomplete from past names).
- Strength block = 3 rounds of 2–3 exercises; session = 3 such blocks + interval block, in order, reorderable.

## "How long on the same progression"
Computed from entries (not stored), counting consecutive **attended** sessions; missed sessions don't reset it.
Two numbers per trainee/exercise:
- **Progression streak** – same progression (progressionId, or same normalized free text), reps ignored. Main badge, e.g. `×4`.
- **Exact streak** – same progression AND same reps/note text. Smaller secondary number, e.g. `×2 exact`.
Shown in the matrix, the exercise summary and the trainee history.
Optional threshold setting (e.g. 4) to highlight "maybe time to progress".

## Screens
1. **Group overview** – trainees × exercises matrix: last progression + `×N` badge. Mobile: card per trainee / sticky-name scrollable grid.
2. **Session planner/runner** – date, attendees, blocks (add/reorder/remove, add any exercise or free text).
   For each trainee × exercise: last stage prefilled, one tap = same / next / jump to any step (ladder picker), free text for injuries.
3. **Block briefing** – before each block: its 2–3 exercises, trainees grouped by the progression they'll do
   ("Archer push-up: Anna, Béla"). This is what you announce to the group.
4. **Exercise summary** – same grouping across the whole group, any time.
5. **Trainee profile** – timeline per date, attendance, per-exercise path with `×N`.
6. **Manage** – groups, trainees, exercise library + ladders, group template (usual workout, edited every ~8 weeks).
7. **Settings** – language, theme, export/import, backup reminder.
8. **Interval timer** – opened from an interval block (or standalone). Work X / rest Y / round-rest Z, rounds, exercise names
   shown per round, big countdown, colour change work vs rest, short beeps for the last 3 s, longer beep at phase change,
   pause/skip/reset. Screen wake lock while running.
9. **Metronome** – tick every second (optional 2 s), pleasant wood-block-like click (short sine/triangle with fast decay,
   slightly higher accent on the beat), volume control. Standalone tool, reachable from the main nav.

Audio notes: Web Audio API, scheduled ahead on the audio clock (not setInterval) so ticks stay even; audio starts on a tap
(browser rule); Wake Lock API keeps the phone awake – a locked screen or backgrounded tab may stop sound on mobile.

## Phases
1. Skeleton, i18n, theme, storage, export/import
2. Manage screens (trainees, groups, exercises + ladders)
3. Session with blocks (strength + interval) and group template
4. Entries: set next stage, block briefing
5. Matrix + exercise summary + streak counter
6. Trainee history
7. Desktop layout, polish, single-file build
8. Interval timer + metronome (Web Audio, wake lock)

## Update: templates and planner
- Templates are named exercise lists (no grouping) managed under Manage -> Templates; several groups can share one, a group
  switches (or copies) its template roughly every 8 weeks. The overview columns come from the group's template.
- New session = planner page: tap exercise names to fill blocks of 3 automatically, or use the 1/2/3/- buttons per row.
  Shortcuts: "like last time", "split by 3", clear; extra exercises outside the template; interval block copied from the last one.
- Data: `templates: [{id, name, exIds[]}]`, `group.templateId`. Old `group.template` blocks are migrated on load/import.
