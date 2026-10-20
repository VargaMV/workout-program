// Web Audio helpers shared by the interval timer and the metronome.
let AC = null, master = null;

function audio() {
  if (!AC) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    AC = new C();
    master = AC.createGain();
    const comp = AC.createDynamicsCompressor();
    master.connect(comp); comp.connect(AC.destination);
    setVolume(db.settings.vol);
  }
  return AC;
}
function setVolume(v) {
  db.settings.vol = v;
  if (master) master.gain.value = v * v;
}
const newBus = () => { const g = AC.createGain(); g.connect(master); return g; };

function tone(bus, time, freq, dur, vol = 0.3, type = 'sine') {
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(vol, time + 0.008);
  g.gain.setValueAtTime(vol, time + Math.max(0.01, dur - 0.07));
  g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  o.connect(g); g.connect(bus);
  o.start(time); o.stop(time + dur + 0.03);
}

// Soft wood-block style click: a short pitched blip with a quick, higher "knock" on top.
function click(bus, time, accent) {
  const f = accent ? 1500 : 1000;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(f * 1.5, time);
  o.frequency.exponentialRampToValueAtTime(f, time + 0.015);
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(0.7, time + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.11);
  o.connect(g); g.connect(bus); o.start(time); o.stop(time + 0.13);
  const o2 = AC.createOscillator(), g2 = AC.createGain();
  o2.type = 'triangle'; o2.frequency.value = f * 2.4;
  g2.gain.setValueAtTime(0.0001, time);
  g2.gain.exponentialRampToValueAtTime(0.25, time + 0.001);
  g2.gain.exponentialRampToValueAtTime(0.0001, time + 0.035);
  o2.connect(g2); g2.connect(bus); o2.start(time); o2.stop(time + 0.05);
}

// Interval timer cues.
function cue(bus, kind, time) {
  switch (kind) {
    case 'tick': tone(bus, time, 880, 0.12, 0.3); break;
    case 'go': tone(bus, time, 1318, 0.55, 0.38); tone(bus, time, 2637, 0.4, 0.08); break;
    case 'rest': tone(bus, time, 784, 0.18, 0.32); tone(bus, time + 0.2, 523, 0.3, 0.32); break;
    case 'rr': [784, 659, 523].forEach((f, i) => tone(bus, time + i * 0.17, f, 0.2, 0.32)); break;
    case 'end': [523, 659, 784, 1046].forEach((f, i) => tone(bus, time + i * 0.16, f, i === 3 ? 0.7 : 0.18, 0.36)); break;
  }
}

let wakeLock = null, wantAwake = false;
async function keepAwake(on) {
  wantAwake = on;
  try {
    if (on) {
      if ('wakeLock' in navigator && !wakeLock) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      }
    } else if (wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) { /* not supported or denied: ignore */ }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && wantAwake) keepAwake(true); });
