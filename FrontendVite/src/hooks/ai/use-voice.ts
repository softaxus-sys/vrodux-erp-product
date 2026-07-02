import * as React from "react";

/**
 * Browser-native voice for the assistant — no backend, no dependency, no token cost.
 * Speech-to-text via the Web Speech API (`SpeechRecognition`) and text-to-speech via
 * `speechSynthesis`. Gracefully reports `supported: false` where the APIs are absent
 * (e.g. Firefox has no SpeechRecognition), so callers hide the mic button.
 */

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
};

function errorMessage(code?: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access is blocked. Allow mic permission for this site and try again.";
    case "no-speech":
      return "I didn't catch any speech — please try again.";
    case "audio-capture":
      return "No microphone was found.";
    case "network":
      return "Speech recognition network error — check your connection.";
    default:
      return "Voice input failed. Please try again or type your question.";
  }
}

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition) as (new () => SpeechRecognitionLike) | undefined;
}

export interface SpeechToText {
  supported: boolean;
  listening: boolean;
  start: () => void;
  stop: () => void;
}

/** Push-to-talk speech recognition. `onFinal` fires with the transcript; `onError` with a user message. */
export function useSpeechToText(onFinal: (text: string) => void, onError?: (msg: string) => void): SpeechToText {
  const cbRef = React.useRef(onFinal);
  cbRef.current = onFinal;
  const errRef = React.useRef(onError);
  errRef.current = onError;

  const recRef = React.useRef<SpeechRecognitionLike | null>(null);
  const [listening, setListening] = React.useState(false);
  const Ctor = React.useMemo(getRecognitionCtor, []);

  const stop = React.useCallback(() => {
    recRef.current?.stop();
    setListening(false);
  }, []);

  const start = React.useCallback(() => {
    if (!Ctor) { errRef.current?.("Voice input isn't supported in this browser. Try Chrome or Edge."); return; }
    try {
      const rec = new Ctor();
      rec.lang = "en-US";
      rec.interimResults = false;
      rec.continuous = false;
      rec.maxAlternatives = 1;
      rec.onresult = (e) => {
        const text = e.results?.[0]?.[0]?.transcript ?? "";
        if (text.trim()) cbRef.current(text.trim());
      };
      rec.onend = () => setListening(false);
      rec.onerror = (e) => { setListening(false); errRef.current?.(errorMessage(e?.error)); };
      recRef.current = rec;
      setListening(true);
      rec.start();
    } catch {
      setListening(false);
      errRef.current?.("Couldn't start voice input. Please try again.");
    }
  }, [Ctor]);

  React.useEffect(() => () => { try { recRef.current?.abort(); } catch { /* noop */ } }, []);

  return { supported: !!Ctor, listening, start, stop };
}

export function speechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Speak text aloud (cancels any in-progress utterance first). Long replies are capped. */
export function speak(text: string) {
  if (!speechSynthesisSupported()) return;
  const clean = text.replace(/[*_#`>]/g, "").slice(0, 700);
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = "en-US";
  u.rate = 1;
  window.speechSynthesis.speak(u);
}

export function cancelSpeech() {
  if (speechSynthesisSupported()) window.speechSynthesis.cancel();
}
