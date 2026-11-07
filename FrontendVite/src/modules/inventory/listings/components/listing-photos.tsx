import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, Package, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { listingsApi, type ListingImage, type ListingVariant, type NewListingPhoto } from "@/lib/inventory/listings.api";
import {
  useAddListingPhotos, useDeleteListingPhoto, useReorderListingPhotos, useSetPrimaryListingPhoto, useUpdateListingPhoto,
} from "@/hooks/inventory/use-listings";

/** Mirrors the server limits, so a file that will be refused is refused before it is uploaded. */
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_PHOTOS = 60;

export const coverOf = (images: ListingImage[]): ListingImage | null =>
  images.find(i => i.isPrimary) ?? images[0] ?? null;

/**
 * One listing photo. The bytes sit behind the bearer token, so an `<img src>` cannot fetch them
 * directly — each is loaded once into an object URL and kept for the session (a photo never changes;
 * replacing it creates a new id).
 */
export function ListingPhoto({ listingId, imageId, className, alt = "" }: {
  listingId: string; imageId: string; className?: string; alt?: string;
}) {
  const { data: url, isError } = useQuery({
    // Outside the "inventory-listings" prefix: every listing change invalidates that whole prefix, and a
    // photo that never changes must not be downloaded again each time someone edits a price.
    queryKey: ["listing-photo", imageId],
    queryFn: () => listingsApi.imageObjectUrl(listingId, imageId),
    staleTime: Infinity, gcTime: Infinity, retry: 1,
  });
  if (!url) {
    return (
      <div className={cn("bg-muted flex items-center justify-center", className)}>
        {isError ? <Package className="h-6 w-6 text-muted-foreground/40" /> : <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/50" />}
      </div>
    );
  }
  return <img src={url} alt={alt} loading="lazy" draggable={false} className={cn("object-cover", className)} />;
}

function readFiles(files: File[], room: number, t: (k: string, o?: Record<string, unknown>) => string): Promise<NewListingPhoto[]> {
  const accepted: File[] = [];
  for (const f of files) {
    if (!f.type.startsWith("image/")) { toast.error(t("listings.photos.notImage", { name: f.name })); continue; }
    if (f.size > MAX_BYTES) { toast.error(t("listings.photos.tooLarge", { name: f.name, mb: MAX_BYTES / 1024 / 1024 })); continue; }
    if (accepted.length >= room) { toast.error(t("listings.photos.tooMany", { max: MAX_PHOTOS })); break; }
    accepted.push(f);
  }
  return Promise.all(accepted.map(f => new Promise<NewListingPhoto>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ data: String(reader.result), fileName: f.name });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(f);
  })));
}

/**
 * The photo section of a listing.
 *
 * A saved listing uploads as soon as files are chosen. A listing that does not exist yet has nowhere
 * to attach them, so they wait in `queued` and are uploaded right after it is created.
 */
export function ListingPhotosEditor({ listingId, images, variants, queued, onQueuedChange, canEdit }: {
  listingId: string | null;
  images: ListingImage[];
  variants: ListingVariant[];
  queued: NewListingPhoto[];
  onQueuedChange: (photos: NewListingPhoto[]) => void;
  canEdit: boolean;
}) {
  const { t } = useTranslation("inventory");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const add = useAddListingPhotos();
  const remove = useDeleteListingPhoto();
  const setPrimary = useSetPrimaryListingPhoto();
  const update = useUpdateListingPhoto();
  const reorder = useReorderListingPhotos();
  const [dragging, setDragging] = React.useState(false);

  const count = listingId ? images.length : queued.length;
  const busy = add.isPending || remove.isPending || setPrimary.isPending || update.isPending || reorder.isPending;

  const take = async (list: FileList | File[] | null) => {
    if (!list || list.length === 0 || !canEdit) return;
    try {
      const photos = await readFiles(Array.from(list), MAX_PHOTOS - count, t);
      if (photos.length === 0) return;
      if (listingId) add.mutate({ id: listingId, images: photos });
      else onQueuedChange([...queued, ...photos]);
    } catch { toast.error(t("listings.photos.readFailed")); }
  };

  const move = (img: ListingImage, dir: -1 | 1) => {
    if (!listingId) return;
    const ids = images.map(i => i.id);
    const at = ids.indexOf(img.id);
    const to = at + dir;
    if (to < 0 || to >= ids.length) return;
    [ids[at], ids[to]] = [ids[to], ids[at]];
    reorder.mutate({ id: listingId, orderedIds: ids });
  };

  const variantLabel = (v: ListingVariant) => Object.values(v.options).join(" / ") || v.name;
  const thumb = "relative aspect-square rounded-xl overflow-hidden border-2 group";
  const overlayBtn = "h-8 w-8 rounded-lg flex items-center justify-center backdrop-blur bg-black/55 text-white hover:bg-black/75 disabled:opacity-50";
  const coverBadge = (
    <span className="absolute top-1.5 start-1.5 px-2 py-0.5 rounded-md bg-primary text-primary-foreground text-[11px] font-extrabold flex items-center gap-1">
      <Star className="h-3 w-3 fill-current" />{t("listings.photos.cover")}
    </span>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">{t("listings.photos.hint")}</span>
        <span className="text-xs font-semibold text-muted-foreground tabular-nums">{count} / {MAX_PHOTOS}</span>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {listingId ? images.map((img, idx) => (
          <div key={img.id} className="space-y-1">
            <div className={cn(thumb, img.isPrimary ? "border-primary" : "border-border")}>
              <ListingPhoto listingId={listingId} imageId={img.id} alt={img.altText ?? ""} className="h-full w-full" />
              {img.isPrimary && coverBadge}
              {canEdit && (
                // Always visible — a touch screen has no hover to reveal them.
                <div className="absolute bottom-1.5 inset-x-1.5 flex justify-between gap-1">
                  <div className="flex gap-1">
                    <button type="button" disabled={busy || idx === 0} title={t("listings.photos.moveEarlier")}
                      onClick={() => move(img, -1)} className={overlayBtn}><ArrowLeft className="h-4 w-4 rtl:rotate-180" /></button>
                    <button type="button" disabled={busy || idx === images.length - 1} title={t("listings.photos.moveLater")}
                      onClick={() => move(img, 1)} className={overlayBtn}><ArrowRight className="h-4 w-4 rtl:rotate-180" /></button>
                  </div>
                  <div className="flex gap-1">
                    {!img.isPrimary && (
                      <button type="button" disabled={busy} title={t("listings.photos.makeCover")}
                        onClick={() => setPrimary.mutate({ id: listingId, imageId: img.id })} className={overlayBtn}>
                        <Star className="h-4 w-4" />
                      </button>
                    )}
                    <button type="button" disabled={busy} title={t("listings.photos.remove")}
                      onClick={() => remove.mutate({ id: listingId, imageId: img.id })} className={overlayBtn}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
            {canEdit && (
              <div className="space-y-1">
                <input
                  defaultValue={img.altText ?? ""} maxLength={300} placeholder={t("listings.photos.altPlaceholder")}
                  aria-label={t("listings.photos.altLabel")}
                  onBlur={e => { const v = e.target.value.trim(); if (v !== (img.altText ?? "")) update.mutate({ id: listingId, imageId: img.id, altText: v || null, productId: img.productId }); }}
                  className="w-full h-7 rounded-md border border-border bg-background px-2 text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/40" />
                {variants.length > 1 && (
                  <select value={img.productId ?? ""} aria-label={t("listings.photos.forVariant")}
                    onChange={e => update.mutate({ id: listingId, imageId: img.id, altText: img.altText, productId: e.target.value || null })}
                    className="w-full h-7 rounded-md border border-border bg-card px-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/40">
                    <option value="">{t("listings.photos.allVariants")}</option>
                    {variants.map(v => <option key={v.productId} value={v.productId}>{variantLabel(v)}</option>)}
                  </select>
                )}
              </div>
            )}
          </div>
        )) : queued.map((p, i) => (
          <div key={i} className={cn(thumb, i === 0 ? "border-primary" : "border-border")}>
            <img src={p.data} alt="" className="h-full w-full object-cover" />
            {i === 0 && coverBadge}
            <div className="absolute bottom-1.5 inset-x-1.5 flex justify-between">
              {i === 0 ? <span /> : (
                <button type="button" title={t("listings.photos.makeCover")} className={overlayBtn}
                  onClick={() => onQueuedChange([p, ...queued.filter((_, x) => x !== i)])}>
                  <Star className="h-4 w-4" />
                </button>
              )}
              <button type="button" title={t("listings.photos.remove")} className={overlayBtn}
                onClick={() => onQueuedChange(queued.filter((_, x) => x !== i))}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}

        {canEdit && count < MAX_PHOTOS && (
          <button type="button" disabled={add.isPending} onClick={() => inputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); void take(e.dataTransfer.files); }}
            className={cn("aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1.5 text-xs font-bold transition-colors",
              count === 0 && "col-span-3 sm:col-span-4 aspect-auto h-28",
              dragging ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary hover:text-primary")}>
            {add.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
            <span className="px-2 text-center">
              {add.isPending ? t("listings.photos.uploading") : count === 0 ? t("listings.photos.addFirst") : t("listings.photos.addMore")}
            </span>
          </button>
        )}
      </div>

      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
        onChange={e => { void take(e.target.files); e.target.value = ""; }} />
    </div>
  );
}
