import type { ModuleKey } from "@/types/global";

/**
 * Video guides live on public object storage, not in our API: a JSON manifest lists every guide and the
 * app resolves the (relative) video / poster paths against the same base.
 *
 * Plain `fetch` on purpose — NOT `rawApiClient`. That client attaches the user's bearer token (which has no
 * business being sent to a third-party host) and redirects to /login on a 401.
 *
 * Override the base per environment with VITE_VIDEO_GUIDES_BASE (no trailing slash).
 */
export const VIDEO_GUIDES_BASE: string = (
  (import.meta.env.VITE_VIDEO_GUIDES_BASE as string | undefined) ??
  "https://sin1.contabostorage.com/5eebb73791834c68aa89cf1633f74425:demo-videos"
).replace(/\/+$/, "");

/**
 * Languages that publish their own manifest (`manifest.<lang>.json` next to the default one).
 * Empty until the Arabic guides are recorded — listing a language here before its file exists would make
 * every user of that language pay for a failing request. Add "ar" when manifest.ar.json is uploaded.
 */
export const LOCALIZED_MANIFESTS: readonly string[] = [];

export interface VideoChapter {
  /** seconds from the start of the video */
  start: number;
  title: string;
}

export interface VideoGuide {
  slug: string;
  order: number;
  title: string;
  category: string;
  description: string;
  /** the app's module key this guide belongs to, or null for guides everyone may see */
  module: string | null;
  durationSeconds: number;
  /** absolute URLs (resolved from the manifest's relative paths) */
  videoUrl: string;
  posterUrl: string;
  chapters: VideoChapter[];
}

interface RawManifest {
  videos?: Array<Partial<VideoGuide> & { video?: string; poster?: string }>;
}

function resolveUrl(path: string | undefined): string {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return `${VIDEO_GUIDES_BASE}/${path.replace(/^\/+/, "")}`;
}

function manifestUrl(language?: string): string {
  const lang = (language ?? "").split("-")[0].toLowerCase();
  return LOCALIZED_MANIFESTS.includes(lang)
    ? `${VIDEO_GUIDES_BASE}/manifest.${lang}.json`
    : `${VIDEO_GUIDES_BASE}/manifest.json`;
}

export async function fetchVideoGuides(language?: string): Promise<VideoGuide[]> {
  const res = await fetch(manifestUrl(language), { credentials: "omit", cache: "no-cache" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw = (await res.json()) as RawManifest;
  if (!raw || !Array.isArray(raw.videos)) throw new Error("Unexpected manifest format");

  return raw.videos
    .filter((v) => v.slug && v.title && v.video)
    .map((v, i): VideoGuide => ({
      slug: v.slug!,
      order: typeof v.order === "number" ? v.order : i + 1,
      title: v.title!,
      category: v.category ?? "",
      description: v.description ?? "",
      module: v.module ?? null,
      durationSeconds: Math.max(0, Math.round(v.durationSeconds ?? 0)),
      videoUrl: resolveUrl(v.video),
      posterUrl: resolveUrl(v.poster),
      chapters: (v.chapters ?? [])
        .filter((c) => typeof c.start === "number" && c.title)
        .sort((a, b) => a.start - b.start),
    }))
    .sort((a, b) => a.order - b.order);
}

/**
 * Manifest module name → the app's ModuleKey, for access filtering. `null` = always visible.
 * Master Data has no module of its own in the app (the nav gates it on "settings"), so it follows that.
 */
const MODULE_ALIASES: Record<string, ModuleKey> = { "master-data": "settings" };

export function guideModuleKey(guide: Pick<VideoGuide, "module">): ModuleKey | null {
  if (!guide.module) return null;
  return (MODULE_ALIASES[guide.module] ?? guide.module) as ModuleKey;
}

/** 75 -> "1:15", 3725 -> "1:02:05" */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
}
