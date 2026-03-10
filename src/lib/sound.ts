// Web Audio API sound utilities for POS feedback

function beep(frequency: number, duration: number, type: OscillatorType = 'sine', volume = 0.3) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = frequency;
    osc.type = type;
    gain.gain.value = volume;
    osc.start();
    osc.stop(ctx.currentTime + duration / 1000);
  } catch { /* AudioContext not available */ }
}

/** Short positive beep — payment confirmed, order sent */
export function playSuccess() {
  beep(660, 150, 'sine', 0.25);
}

/** Tiny click — generic button tap */
export function playClick() {
  beep(1000, 50, 'sine', 0.15);
}

/** Triple beep — kitchen new-order notification */
export function playNotification() {
  try {
    const ctx = new AudioContext();
    [0, 0.25, 0.5].forEach(delay => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = 'square';
      gain.gain.value = 0.3;
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.15);
    });
  } catch { /* AudioContext not available */ }
}
