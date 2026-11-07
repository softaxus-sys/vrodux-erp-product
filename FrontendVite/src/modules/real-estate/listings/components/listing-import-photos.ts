import { reApi } from "@/lib/real-estate/re.api";

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;   // the server's per-photo limit
const PER_REQUEST     = 20;                // the server's per-request cap
const MAX_PER_BUILDING = 10;               // a gallery, not an archive

/** Splits one cell into URLs. Accepts " | ", commas, semicolons, spaces or new lines between them. */
export function parseImageUrls(cell: string | undefined): string[] {
  return (cell ?? "").split(/[\s|;,]+/).filter(u => /^https?:\/\//i.test(u));
}

/** building name (lower-case) → its distinct photo URLs, in the order first seen. */
export function collectBuildingPhotos(rows: Record<string, string>[]): Map<string, { name: string; urls: string[] }> {
  const out = new Map<string, { name: string; urls: string[] }>();
  for (const r of rows) {
    const name = (r.building ?? "").trim();
    if (!name) continue;
    const urls = parseImageUrls(r.imageUrls);
    if (urls.length === 0) continue;
    const entry = out.get(name.toLowerCase()) ?? { name, urls: [] };
    for (const u of urls) if (!entry.urls.includes(u) && entry.urls.length < MAX_PER_BUILDING) entry.urls.push(u);
    out.set(name.toLowerCase(), entry);
  }
  return out;
}

async function fetchAsDataUri(url: string): Promise<string> {
  const res = await fetch(url, { referrerPolicy: "no-referrer" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  if (!blob.type.startsWith("image/") || blob.size > MAX_PHOTO_BYTES) throw new Error("Not a usable image");
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export interface PhotoOutcome { added: number; failed: number; skippedBuildings: number }

/**
 * Adds each building's photos to its gallery once the rows are imported.
 *
 * <p>Runs in the browser so the server never fetches a URL a spreadsheet handed it. A building
 * that already has photos is left alone, so re-importing a file never doubles its gallery.
 * Best effort: a photo that cannot be fetched is counted, never fatal.</p>
 */
export async function attachBuildingPhotos(rows: Record<string, string>[]): Promise<PhotoOutcome> {
  const result: PhotoOutcome = { added: 0, failed: 0, skippedBuildings: 0 };
  for (const { name, urls } of collectBuildingPhotos(rows).values()) {
    try {
      const page = await reApi.getProperties({ search: name, pageSize: 50 });
      const match = page.items.find(p => p.name.trim().toLowerCase() === name.toLowerCase());
      if (!match) { result.failed += urls.length; continue; }
      const full = await reApi.getProperty(match.id);
      if ((full.images?.length ?? 0) > 0) { result.skippedBuildings++; continue; }

      const images: { data: string; fileName: string }[] = [];
      for (const url of urls) {
        try { images.push({ data: await fetchAsDataUri(url), fileName: url.split("?")[0].split("/").pop() || "photo.jpg" }); }
        catch { result.failed++; }
      }
      for (let i = 0; i < images.length; i += PER_REQUEST) {
        const chunk = images.slice(i, i + PER_REQUEST);
        try { await reApi.addPropertyImages(match.id, chunk); result.added += chunk.length; }
        catch { result.failed += chunk.length; }
      }
    } catch { result.failed += urls.length; }
  }
  return result;
}
