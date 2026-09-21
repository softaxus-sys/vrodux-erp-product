/**
 * A short two-note chime, synthesised with the Web Audio API.
 *
 * <p>No audio file and no dependency — the same call as lib/pdf.ts. An asset would need hosting,
 * cache-busting and a format fallback for about 40 lines of oscillator code, and it would still be
 * one fixed sound.</p>
 *
 * <p>Deliberately quiet and short (~0.35s, peak gain 0.12). This fires while someone is working; an
 * alert that startles gets muted permanently, which is worse than no sound at all.</p>
 */

let ctx: AudioContext | null = null;

/** Reused across plays — browsers cap how many AudioContexts a page may create. */
function context(): AudioContext | null {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx ??= new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

/**
 * Plays the chime. Safe to call at any time: every failure path is swallowed, because a blocked or
 * unavailable audio context must never interfere with showing the notification itself.
 *
 * <p>Browsers refuse to start audio until the page has been interacted with. That is why nothing is
 * forced here — if the context is suspended and cannot resume, the chime is simply skipped. In
 * practice a user who has been clicking around the ERP has already satisfied the gesture requirement.</p>
 */
export function playNotificationChime(): void {
  const audio = context();
  if (!audio) return;

  try {
    if (audio.state === "suspended") void audio.resume().catch(() => {});

    const now = audio.currentTime;
    // Two notes a fifth apart (G5 → D6): reads as a "ping" rather than an alarm.
    play(audio, 784, now, 0.16);
    play(audio, 1175, now + 0.11, 0.22);
  } catch {
    /* never let audio break the notification */
  }
}

function play(audio: AudioContext, frequency: number, startAt: number, duration: number): void {
  const osc = audio.createOscillator();
  const gain = audio.createGain();

  // A sine has no harmonics, so it stays soft at any volume — a square or saw at this pitch is shrill.
  osc.type = "sine";
  osc.frequency.setValueAtTime(frequency, startAt);

  // Exponential fade to near-silence, not a hard stop: an abrupt cut produces an audible click.
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.12, startAt + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  osc.connect(gain).connect(audio.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
}
