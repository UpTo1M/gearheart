// Gearheart — sound: every effect is synthesised with WebAudio, no audio files.
// A soft music-box loop runs under the game; M mutes everything.
const NOTES = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51];

export function createSound() {
  let context = null;
  let master = null;
  let muted = false;
  let musicTimer = null;
  let musicStep = 0;

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  /** Resume the context on a user gesture (browsers block audio before one). */
  function unlock() {
    if (ensure() && context.state === 'suspended') void context.resume();
  }

  function tone(freq, when, duration, type, volume, slideTo) {
    if (!context || muted) return;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, when + duration);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(volume, when + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(when);
    osc.stop(when + duration + 0.05);
  }

  function noise(when, duration, volume, cutoff) {
    if (!context || muted) return;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, when);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(when);
  }

  function now() {
    return context ? context.currentTime : 0;
  }

  const sound = {
    unlock,
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },

    rotate() {
      if (!ensure() || muted) return;
      noise(now(), 0.07, 0.25, 900);
      tone(180, now(), 0.06, 'square', 0.08, 120);
    },
    place() {
      if (!ensure() || muted) return;
      noise(now(), 0.09, 0.3, 500);
      tone(140, now(), 0.1, 'triangle', 0.18, 90);
    },
    pickup() {
      if (!ensure() || muted) return;
      tone(320, now(), 0.08, 'triangle', 0.12, 480);
    },
    denied() {
      if (!ensure() || muted) return;
      tone(110, now(), 0.12, 'sawtooth', 0.08, 80);
    },
    power() {
      if (!ensure() || muted) return;
      const t = now();
      tone(660, t, 0.14, 'sine', 0.14);
      tone(990, t + 0.05, 0.16, 'sine', 0.1);
    },
    sun() {
      if (!ensure() || muted) return;
      const t = now();
      tone(1046.5, t, 0.2, 'sine', 0.16);
      tone(1568, t + 0.08, 0.28, 'sine', 0.12);
    },
    tick() {
      if (!ensure() || muted) return;
      tone(1200, now(), 0.05, 'square', 0.05);
    },
    level() {
      if (!ensure() || muted) return;
      const t = now();
      [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((f, i) => tone(f, t + i * 0.09, 0.3, 'triangle', 0.16));
    },
    lose() {
      if (!ensure() || muted) return;
      const t = now();
      tone(220, t, 0.35, 'sawtooth', 0.1, 110);
      tone(165, t + 0.15, 0.4, 'sawtooth', 0.08, 82);
    },
    win() {
      if (!ensure() || muted) return;
      const t = now();
      [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.51].forEach((f, i) => tone(f, t + i * 0.11, 0.34, 'triangle', 0.15));
    },
    click() {
      if (!ensure() || muted) return;
      tone(440, now(), 0.05, 'sine', 0.1);
    },

    /** Start the quiet music-box loop (a slow pentatonic wander). */
    startMusic() {
      if (!ensure() || musicTimer) return;
      musicTimer = window.setInterval(() => {
        if (muted || !context) return;
        musicStep += 1;
        const walk = [0, 2, 4, 7, 4, 2, 5, 3];
        const note = NOTES[walk[musicStep % walk.length]];
        tone(note, now(), 0.9, 'sine', 0.045);
        if (musicStep % 4 === 0) tone(note / 2, now(), 1.4, 'triangle', 0.03);
      }, 420);
    },
    stopMusic() {
      if (musicTimer) {
        window.clearInterval(musicTimer);
        musicTimer = null;
      }
    },
  };
  return sound;
}
