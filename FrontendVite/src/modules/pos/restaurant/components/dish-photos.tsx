import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ImagePlus, Loader2, Star, Trash2, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { restaurantApi, type MenuItem, type MenuItemImage } from "@/lib/restaurant/restaurant.api";
import { useAddItemImages, useDeleteItemImage, useSetPrimaryItemImage } from "@/hooks/restaurant/use-restaurant";

/** Mirrors the server limits, so a file that will be refused is refused before it is uploaded. */
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_PHOTOS = 12;

export interface NewPhoto { data: string; fileName: string }

export const coverOf = (item: Pick<MenuItem, "images">): MenuItemImage | null =>
  item.images?.find(i => i.isPrimary) ?? item.images?.[0] ?? null;

/**
 * One dish photo. The bytes sit behind the bearer token, so an `<img src>` cannot fetch them
 * directly — they are loaded once into an object URL and kept for the session (a photo never
 * changes; replacing it creates a new id).
 */
export function DishPhoto({ itemId, imageId, className, alt = "" }: {
  itemId: string; imageId: string; className?: string; alt?: string;
}) {
  const { data: url, isError } = useQuery({
    // Deliberately outside the "restaurant" key prefix: every order action invalidates that whole
    // prefix, and a photo that never changes must not be re-downloaded each time someone adds a dish.
    queryKey: ["dish-photo", imageId],
    queryFn: () => restaurantApi.getItemImageObjectUrl(itemId, imageId),
    staleTime: Infinity, gcTime: Infinity, retry: 1,
  });
  if (!url) {
    return (
      <div className={cn("bg-muted flex items-center justify-center", className)}>
        {isError ? <UtensilsCrossed className="h-6 w-6 text-muted-foreground/40" /> : <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/50" />}
      </div>
    );
  }
  return <img src={url} alt={alt} loading="lazy" draggable={false} className={cn("object-cover", className)} />;
}

function readFiles(files: File[], room: number, t: (k: string, o?: Record<string, unknown>) => string): Promise<NewPhoto[]> {
  const accepted: File[] = [];
  for (const f of files) {
    if (!f.type.startsWith("image/")) { toast.error(t("menuMgmt.photos.notImage", { name: f.name })); continue; }
    if (f.size > MAX_BYTES) { toast.error(t("menuMgmt.photos.tooLarge", { name: f.name, mb: MAX_BYTES / 1024 / 1024 })); continue; }
    if (accepted.length >= room) { toast.error(t("menuMgmt.photos.tooMany", { max: MAX_PHOTOS })); break; }
    accepted.push(f);
  }
  return Promise.all(accepted.map(f => new Promise<NewPhoto>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ data: String(reader.result), fileName: f.name });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(f);
  })));
}

/**
 * The photo section of the dish form.
 *
 * A saved dish uploads as soon as files are chosen. A dish that does not exist yet has nowhere to
 * attach them, so they wait in `queued` and are uploaded right after the dish is created.
 */
export function DishPhotosEditor({ item, queued, onQueuedChange }: {
  item: MenuItem | null; queued: NewPhoto[]; onQueuedChange: (photos: NewPhoto[]) => void;
}) {
  const { t } = useTranslation("restaurant");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const add = useAddItemImages();
  const remove = useDeleteItemImage();
  const setPrimary = useSetPrimaryItemImage();
  const [dragging, setDragging] = React.useState(false);

  const saved = item?.images ?? [];
  const count = item ? saved.length : queued.length;
  const busy = add.isPending || remove.isPending || setPrimary.isPending;

  const take = async (list: FileList | File[] | null) => {
    if (!list || list.length === 0) return;
    try {
      const photos = await readFiles(Array.from(list), MAX_PHOTOS - count, t);
      if (photos.length === 0) return;
      if (item) add.mutate({ itemId: item.id, images: photos });
      else onQueuedChange([...queued, ...photos]);
    } catch { toast.error(t("menuMgmt.photos.readFailed")); }
  };

  const thumb = "relative aspect-square rounded-xl overflow-hidden border-2 group";
  const overlayBtn = "h-9 w-9 rounded-lg flex items-center justify-center backdrop-blur bg-black/55 text-white hover:bg-black/75 disabled:opacity-50";

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-bold text-muted-foreground">{t("menuMgmt.photos.label")}</span>
        <span className="text-sm font-semibold text-muted-foreground tabular-nums">{count} / {MAX_PHOTOS}</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {item ? saved.map(img => (
          <div key={img.id} className={cn(thumb, img.isPrimary ? "border-primary" : "border-border")}>
            <DishPhoto itemId={item.id} imageId={img.id} className="h-full w-full" />
            {img.isPrimary && (
              <span className="absolute top-1.5 start-1.5 px-2 py-0.5 rounded-md bg-primary text-primary-foreground text-xs font-extrabold flex items-center gap-1">
                <Star className="h-3 w-3 fill-current" />{t("menuMgmt.photos.cover")}
              </span>
            )}
            {/* Always visible — a touch screen has no hover to reveal them. */}
            <div className="absolute bottom-1.5 inset-x-1.5 flex justify-between">
              {img.isPrimary ? <span /> : (
                <button type="button" disabled={busy} title={t("menuMgmt.photos.makeCover")}
                  onClick={() => setPrimary.mutate({ itemId: item.id, imageId: img.id })} className={overlayBtn}>
                  <Star className="h-4 w-4" />
                </button>
              )}
              <button type="button" disabled={busy} title={t("menuMgmt.photos.remove")}
                onClick={() => remove.mutate({ itemId: item.id, imageId: img.id })} className={overlayBtn}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        )) : queued.map((p, i) => (
          <div key={i} className={cn(thumb, i === 0 ? "border-primary" : "border-border")}>
            <img src={p.data} alt="" className="h-full w-full object-cover" />
            {i === 0 && (
              <span className="absolute top-1.5 start-1.5 px-2 py-0.5 rounded-md bg-primary text-primary-foreground text-xs font-extrabold flex items-center gap-1">
                <Star className="h-3 w-3 fill-current" />{t("menuMgmt.photos.cover")}
              </span>
            )}
            <div className="absolute bottom-1.5 inset-x-1.5 flex justify-between">
              {i === 0 ? <span /> : (
                <button type="button" title={t("menuMgmt.photos.makeCover")} className={overlayBtn}
                  onClick={() => onQueuedChange([p, ...queued.filter((_, x) => x !== i)])}>
                  <Star className="h-4 w-4" />
                </button>
              )}
              <button type="button" title={t("menuMgmt.photos.remove")} className={overlayBtn}
                onClick={() => onQueuedChange(queued.filter((_, x) => x !== i))}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}

        {count < MAX_PHOTOS && (
          <button type="button" disabled={add.isPending} onClick={() => inputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); void take(e.dataTransfer.files); }}
            className={cn("aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1.5 text-sm font-bold transition-colors",
              count === 0 && "col-span-3 aspect-auto h-28",
              dragging ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary hover:text-primary")}>
            {add.isPending ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImagePlus className="h-6 w-6" />}
            <span className="px-2 text-center">{add.isPending ? t("menuMgmt.photos.uploading") : count === 0 ? t("menuMgmt.photos.addFirst") : t("menuMgmt.photos.addMore")}</span>
          </button>
        )}
      </div>

      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
        onChange={e => { void take(e.target.files); e.target.value = ""; }} />
    </div>
  );
}
