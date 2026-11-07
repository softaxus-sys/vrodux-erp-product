import * as React from "react";
import { ChevronLeft, ChevronRight, Download, Share2, ImagePlus, Loader2, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  useAddPropertyImages,
  useDeletePropertyImage,
  useSetPrimaryPropertyImage,
} from "@/hooks/real-estate/use-re";
import { reApi, type PropertyImageDto } from "@/lib/real-estate/re.api";

/** Kept in step with the server's per-image ceiling, so an oversized file is caught here first. */
const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp,image/avif";

export interface StagedImage {
  data: string;
  fileName: string;
}

/**
 * Reads a file to a data URI, which is the shape the upload endpoint takes.
 * Rejects on read failure rather than resolving empty — an empty string would be sent as a
 * valid-looking upload and stored as a corrupt image.
 */
function readAsDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

async function filesToStaged(files: FileList | null): Promise<StagedImage[]> {
  if (!files?.length) return [];
  const out: StagedImage[] = [];

  for (const file of Array.from(files)) {
    if (!file.type.startsWith("image/")) {
      toast.error(`${file.name} is not an image.`);
      continue;
    }
    if (file.size > MAX_BYTES) {
      toast.error(`${file.name} is ${(file.size / 1024 / 1024).toFixed(1)}MB. The limit is 8MB.`);
      continue;
    }
    try {
      out.push({ data: await readAsDataUri(file), fileName: file.name });
    } catch {
      toast.error(`Could not read ${file.name}.`);
    }
  }
  return out;
}

/**
 * Renders one uploaded property photo. The image endpoint needs the JWT bearer (see
 * getPropertyImageObjectUrl's own remarks), so it can't be a plain <img src> — a raw <img src>
 * pointed at that URL 401s every time, since a browser never attaches a custom Authorization
 * header to an <img> request. Fetches the bytes as a blob and revokes the object URL on unmount
 * or when the image changes, mirroring DocumentPreviewModal's established pattern.
 */
export function PropertyImg({
  propertyId, imageId, alt, className,
}: { propertyId: string; imageId: string; alt?: string; className?: string }) {
  const [url, setUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    let revoked = false;
    let objectUrl: string | null = null;

    reApi.getPropertyImageObjectUrl(propertyId, imageId)
      .then((u) => {
        if (revoked) { URL.revokeObjectURL(u); return; }
        objectUrl = u;
        setUrl(u);
      })
      .catch(() => { /* left null — the muted background placeholder shows through */ });

    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [propertyId, imageId]);

  if (!url) return <div className={`animate-pulse bg-muted ${className ?? ""}`} />;
  return <img src={url} alt={alt} className={className} />;
}

/**
 * Photo manager for the property form.
 *
 * Two modes, because a new property has no id to upload against yet:
 *  - creating: files are staged in the parent's state and uploaded once the property exists
 *  - editing:  files upload immediately and the existing gallery is managed in place
 */
export function PropertyPhotos({
  propertyId,
  images,
  staged,
  onStagedChange,
}: {
  propertyId?: string;
  images?: PropertyImageDto[] | null;
  staged: StagedImage[];
  onStagedChange: (next: StagedImage[]) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);

  const addImages = useAddPropertyImages();
  const deleteImage = useDeletePropertyImage();
  const setPrimary = useSetPrimaryPropertyImage();

  const existing = (images ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    setBusy(true);
    try {
      const picked = await filesToStaged(event.target.files);
      if (picked.length === 0) return;

      if (propertyId) {
        await addImages.mutateAsync({ propertyId, images: picked });
        toast.success(picked.length === 1 ? "Photo added." : `${picked.length} photos added.`);
      } else {
        onStagedChange([...staged, ...picked]);
      }
    } finally {
      setBusy(false);
      // Clearing the input matters: re-selecting the same file fires no change event
      // otherwise, so a user who removed a photo could not add it back.
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const total = existing.length + staged.length;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Photos {total > 0 && <span className="text-muted-foreground/70">({total})</span>}
        </label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
          <span className="ml-1.5">Add photos</span>
        </Button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={onPick}
      />

      {total === 0 ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
        >
          <ImagePlus className="h-5 w-5 mx-auto mb-2 opacity-60" />
          Add photos of this property
          <span className="block text-xs mt-1 opacity-70">JPG, PNG or WebP · up to 8MB each</span>
        </button>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {existing.map((img) => (
            <div key={img.id} className="relative group aspect-[4/3] rounded-lg overflow-hidden bg-muted">
              <PropertyImg
                propertyId={propertyId!}
                imageId={img.id}
                alt={img.fileName ?? "Property photo"}
                className="h-full w-full object-cover"
              />
              {img.isPrimary && (
                <span className="absolute top-1.5 left-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                  Cover
                </span>
              )}
              <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                {!img.isPrimary && (
                  <button
                    type="button"
                    title="Use as cover photo"
                    onClick={() => setPrimary.mutate({ propertyId: propertyId!, imageId: img.id })}
                    className="rounded-full bg-white/90 p-1.5 hover:bg-white"
                  >
                    <Star className="h-3.5 w-3.5 text-foreground" />
                  </button>
                )}
                <button
                  type="button"
                  title="Remove photo"
                  onClick={() => deleteImage.mutate({ propertyId: propertyId!, imageId: img.id })}
                  className="rounded-full bg-white/90 p-1.5 hover:bg-white"
                >
                  <Trash2 className="h-3.5 w-3.5 text-red-600" />
                </button>
              </div>
            </div>
          ))}

          {staged.map((img, i) => (
            <div
              key={`${img.fileName}-${i}`}
              className="relative group aspect-[4/3] rounded-lg overflow-hidden bg-muted"
            >
              <img src={img.data} alt={img.fileName} className="h-full w-full object-cover" />
              <span className="absolute bottom-1.5 left-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
                Pending
              </span>
              <button
                type="button"
                title="Remove"
                onClick={() => onStagedChange(staged.filter((_, idx) => idx !== i))}
                className="absolute top-1.5 right-1.5 rounded-full bg-white/90 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3 text-foreground" />
              </button>
            </div>
          ))}
        </div>
      )}

      {!propertyId && staged.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          These upload once the property is saved.
        </p>
      )}
    </div>
  );
}

/**
 * One building photo as a JPEG file. Uploads are stored as WebP, which WhatsApp and some phones
 * treat as a sticker or refuse to show as a photo, so they are re-encoded to JPEG for sharing.
 */
async function propertyImageAsJpeg(propertyId: string, img: PropertyImageDto, baseName: string, index: number): Promise<File> {
  const url = await reApi.getPropertyImageObjectUrl(propertyId, img.id);
  try {
    const el = new Image();
    el.src = url;
    await el.decode();
    const canvas = document.createElement("canvas");
    canvas.width = el.naturalWidth;
    canvas.height = el.naturalHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff"; // JPEG has no transparency
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(el, 0, 0);
    const blob = await new Promise<Blob>((res, rej) =>
      canvas.toBlob(b => (b ? res(b) : rej(new Error("encode"))), "image/jpeg", 0.92));
    const safe = baseName.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "property";
    const stem = img.fileName?.trim().replace(/\.[^.]+$/, "");
    return new File([blob], `${stem || `${safe}-${index + 1}`}.jpg`, { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function saveFile(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Read-only photo slider for anyone viewing a property or listing: one large photo with
 * previous / next, thumbnails, and buttons to download the current photo or all of them.
 */
export function PropertyPhotoSlider({
  propertyId, images, name, className,
}: { propertyId: string; images: PropertyImageDto[]; name: string; className?: string }) {
  const ordered = React.useMemo(
    () => [...images].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder),
    [images]);
  const [index, setIndex] = React.useState(0);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => { if (index >= ordered.length) setIndex(0); }, [ordered.length, index]);
  if (ordered.length === 0) return null;

  const current = ordered[Math.min(index, ordered.length - 1)];
  const go = (d: number) => setIndex(i => (i + d + ordered.length) % ordered.length);

  const files = (list: PropertyImageDto[]) =>
    Promise.all(list.map(img => propertyImageAsJpeg(propertyId, img, name, ordered.indexOf(img))));

  const run = async (list: PropertyImageDto[]) => {
    setBusy(true);
    try {
      for (const f of await files(list)) {
        saveFile(f);
        // Browsers drop rapid back-to-back downloads; space them out a little.
        if (list.length > 1) await new Promise(r => setTimeout(r, 350));
      }
    } catch {
      toast.error("Could not download the photo. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  // Phones (and some desktop browsers) can hand files straight to WhatsApp through the share sheet.
  const canShare = typeof navigator !== "undefined" && typeof navigator.canShare === "function";
  const share = async () => {
    setBusy(true);
    try {
      const list = await files(ordered);
      if (navigator.canShare?.({ files: list })) {
        await navigator.share({ files: list, title: name });
      } else {
        toast.info("Sharing isn't available on this device — use Download, then attach in WhatsApp.");
      }
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") toast.error("Could not share the photos.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <div className="relative group">
        <PropertyImg key={current.id} propertyId={propertyId} imageId={current.id}
          alt={current.caption ?? name}
          className="w-full h-56 object-cover rounded-xl border border-border bg-muted" />
        {ordered.length > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Previous photo"
              className="absolute start-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70">
              <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Next photo"
              className="absolute end-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70">
              <ChevronRight className="w-4 h-4 rtl:rotate-180" />
            </button>
            <span className="absolute bottom-2 end-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white">
              {index + 1} / {ordered.length}
            </span>
          </>
        )}
      </div>

      {current.caption && <p className="text-xs text-muted-foreground">{current.caption}</p>}

      {ordered.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {ordered.map((img, i) => (
            <button key={img.id} type="button" onClick={() => setIndex(i)} aria-label={`Photo ${i + 1}`}
              className={`shrink-0 rounded-md border-2 ${i === index ? "border-primary" : "border-transparent opacity-70 hover:opacity-100"}`}>
              <PropertyImg propertyId={propertyId} imageId={img.id} className="h-12 w-16 object-cover rounded" />
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button type="button" disabled={busy} onClick={() => run([current])}
          className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-lg border border-border text-xs hover:bg-muted disabled:opacity-50">
          <Download className="w-3.5 h-3.5" /> Download photo
        </button>
        {ordered.length > 1 && (
          <button type="button" disabled={busy} onClick={() => run(ordered)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-lg border border-border text-xs hover:bg-muted disabled:opacity-50">
            <Download className="w-3.5 h-3.5" /> {busy ? "Downloading…" : `Download all (${ordered.length})`}
          </button>
        )}
        {canShare && (
          <button type="button" disabled={busy} onClick={share}
            className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-lg border border-border text-xs hover:bg-muted disabled:opacity-50">
            <Share2 className="w-3.5 h-3.5" /> Share
          </button>
        )}
      </div>
    </div>
  );
}
