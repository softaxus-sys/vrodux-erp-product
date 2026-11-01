import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { rawApiClient, ApiError } from "@/lib/api-client";
import { getApiBaseUrl } from "@/lib/desktop";
import { useAuthStore } from "@/store/auth.store";

const BASE = `${getApiBaseUrl()}/api/ai/voice-chat`;

export interface VoiceChatStatus {
  /** Speech in and out can be served for this workspace right now. */
  available: boolean;
  /** The shared platform voice is answering (not the workspace's own key). */
  usingPlatform: boolean;
  requestsUsed: number;
  /** 0 = unlimited. */
  requestCap: number;
  voice: string | null;
}

/** Whether talking to the assistant through the server is possible, and how much of the shared voice is left. */
export function useServerVoiceStatus(enabled = true) {
  return useQuery<VoiceChatStatus>({
    queryKey: ["ai", "voice-chat", "status"],
    queryFn: () => rawApiClient.get(`${BASE}/status`),
    enabled,
    staleTime: 60_000,
    retry: false,
  });
}

function pickMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"].find((m) => MediaRecorder.isTypeSupported(m));
}

const formatOf = (mime: string) => (mime.includes("ogg") ? "ogg" : mime.includes("mp4") ? "mp4" : "webm");

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/**
 * Browsers record WebM/Opus, which speech APIs often refuse. Decode it and re-encode as 16 kHz mono
 * 16-bit WAV, which every transcription service accepts (about 2 MB for a minute of speech).
 * Returns null when the browser cannot decode it, so the caller can send the original instead.
 */
async function toWav(blob: Blob): Promise<Blob | null> {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    void ctx.close();

    const rate = 16000;
    const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * rate)), rate);
    const src = off.createBufferSource();
    src.buffer = decoded;
    src.connect(off.destination);
    src.start();
    const pcm = (await off.startRendering()).getChannelData(0);

    const buf = new ArrayBuffer(44 + pcm.length * 2);
    const v = new DataView(buf);
    const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, "RIFF"); v.setUint32(4, 36 + pcm.length * 2, true); w(8, "WAVE"); w(12, "fmt ");
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    w(36, "data"); v.setUint32(40, pcm.length * 2, true);
    for (let i = 0; i < pcm.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i])) * 0x7fff, true);
    return new Blob([buf], { type: "audio/wav" });
  } catch {
    return null;
  }
}

export interface ServerRecorder {
  supported: boolean;
  recording: boolean;
  /** True while the recording is being turned into text. */
  working: boolean;
  start: () => void;
  stop: () => void;
}

/**
 * Push-to-talk through the server: records the microphone, sends it for transcription, and hands
 * the text to `onText`. Works in any browser with MediaRecorder (Firefox and Safari included),
 * unlike the browser's built-in recognition. A spoken question is capped at one minute.
 */
export function useServerRecorder(onText: (text: string) => void, onError: (msg: string) => void): ServerRecorder {
  const textRef = React.useRef(onText); textRef.current = onText;
  const errRef = React.useRef(onError); errRef.current = onError;
  const recRef = React.useRef<MediaRecorder | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const timerRef = React.useRef<number | undefined>(undefined);
  const [recording, setRecording] = React.useState(false);
  const [working, setWorking] = React.useState(false);
  const supported = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";

  const release = React.useCallback(() => {
    window.clearTimeout(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const stop = React.useCallback(() => {
    if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
  }, []);

  const start = React.useCallback(async () => {
    if (!supported || recRef.current?.state === "recording") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickMime();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      rec.onstop = async () => {
        setRecording(false);
        release();
        const type = rec.mimeType || mime || "audio/webm";
        const blob = new Blob(chunks, { type });
        if (blob.size < 1500) { errRef.current("I didn't catch anything — hold the mic a little longer."); return; }
        setWorking(true);
        try {
          const audioBase64 = await toBase64(blob);
          const res = await rawApiClient.post<{ text: string }>(`${BASE}/transcribe`, { audioBase64, format: formatOf(type), language: null });
          if (res.text?.trim()) textRef.current(res.text.trim());
          else errRef.current("I couldn't make out any words. Please try again.");
        } catch (e) {
          errRef.current(e instanceof ApiError ? e.message : "Voice input failed. Please try again.");
        } finally {
          setWorking(false);
        }
      };
      recRef.current = rec;
      rec.start();
      setRecording(true);
      timerRef.current = window.setTimeout(stop, 60_000);
    } catch {
      release();
      setRecording(false);
      errRef.current("Microphone access is blocked. Allow the microphone for this site and try again.");
    }
  }, [supported, release, stop]);

  React.useEffect(() => () => { try { recRef.current?.stop(); } catch { /* noop */ } release(); }, [release]);

  return { supported, recording, working, start, stop };
}

let current: HTMLAudioElement | null = null;

export function stopServerSpeech() {
  if (current) { current.pause(); current = null; }
}

/** Reads text aloud through the server voice. Rejects when it cannot, so the caller can fall back to the browser voice. */
export async function speakServer(text: string): Promise<void> {
  const clean = text.replace(/[*_#`>|]/g, "").replace(/\s+/g, " ").trim().slice(0, 900);
  if (!clean) return;
  stopServerSpeech();

  const { token } = useAuthStore.getState();
  const res = await fetch(`${BASE}/speak`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ text: clean }),
  });
  if (!res.ok) throw new Error(`Speech failed (HTTP ${res.status}).`);

  const url = URL.createObjectURL(await res.blob());
  const audio = new Audio(url);
  current = audio;
  audio.onended = () => { URL.revokeObjectURL(url); if (current === audio) current = null; };
  await audio.play();
}
