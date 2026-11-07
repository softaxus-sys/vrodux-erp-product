import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ImagePlus, Loader2, Package, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Can } from "@/components/auth/can";
import { productPhotosApi } from "@/lib/inventory/product-photos.api";
import { useAddProductPhotos, useDeleteProductPhoto, useProductPhotos, useSetPrimaryProductPhoto } from "@/hooks/inventory/use-product-photos";

/** Mirrors the server limits, so a file that will be refused is refused before it is uploaded. */
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_PHOTOS = 20;

function Thumb({ productId, imageId, alt }: { productId: string; imageId: string; alt: string }) {
  const { data: url, isError } = useQuery({
    queryKey: ["product-photo", imageId],
    queryFn: () => productPhotosApi.objectUrl(productId, imageId),
    staleTime: Infinity, gcTime: Infinity, retry: 1,
  });
  if (!url) {
    return (
      <div className="h-full w-full bg-muted flex items-center justify-center">
        {isError ? <Package className="h-6 w-6 text-muted-foreground/40" /> : <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/50" />}
      </div>
    );
  }
  return <img src={url} alt={alt} loading="lazy" draggable={false} className="h-full w-full object-cover" />;
}

function read(file: File): Promise<{ data: string; fileName: string }> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve({ data: String(r.result), fileName: file.name });
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

/**
 * Photos of a stock item. They belong to the item, so POS, the restaurant and the online listing all show
 * the same pictures; an item that joins a listing brings them along.
 */
export function ProductPhotos({ productId }: { productId: string }) {
  const { t } = useTranslation("inventory");
  const { data: photos = [], isLoading } = useProductPhotos(productId);
  const add = useAddProductPhotos();
  const remove = useDeleteProductPhoto();
  const setPrimary = useSetPrimaryProductPhoto();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const busy = add.isPending || remove.isPending || setPrimary.isPending;

  const take = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const ok: File[] = [];
    for (const f of Array.from(list)) {
      if (!f.type.startsWith("image/")) { toast.error(t("listings.photos.notImage", { name: f.name })); continue; }
      if (f.size > MAX_BYTES) { toast.error(t("listings.photos.tooLarge", { name: f.name, mb: MAX_BYTES / 1024 / 1024 })); continue; }
      if (photos.length + ok.length >= MAX_PHOTOS) { toast.error(t("listings.photos.tooMany", { max: MAX_PHOTOS })); break; }
      ok.push(f);
    }
    if (ok.length === 0) return;
    try { add.mutate({ productId, images: await Promise.all(ok.map(read)) }); }
    catch { toast.error(t("listings.photos.readFailed")); }
    if (inputRef.current) inputRef.current.value = "";
  };

  const overlayBtn = "h-7 w-7 rounded-lg flex items-center justify-center backdrop-blur bg-black/55 text-white hover:bg-black/75 disabled:opacity-50";

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("listings.productPhotos.title")}</h3>
        <span className="text-xs font-semibold text-muted-foreground tabular-nums">{photos.length} / {MAX_PHOTOS}</span>
      </div>
      <p className="text-xs text-muted-foreground mb-2">{t("listings.productPhotos.hint")}</p>

      <div className="grid grid-cols-4 gap-2">
        {photos.map(p => (
          <div key={p.id} className={cn("relative aspect-square rounded-xl overflow-hidden border-2", p.isPrimary ? "border-primary" : "border-border")}>
            <Thumb productId={productId} imageId={p.id} alt={p.altText ?? ""} />
            {p.isPrimary && (
              <span className="absolute top-1 start-1 px-1.5 py-0.5 rounded-md bg-primary text-primary-foreground text-[10px] font-extrabold flex items-center gap-0.5">
                <Star className="h-2.5 w-2.5 fill-current" />{t("listings.photos.cover")}
              </span>
            )}
            <Can permission="inventory.stock.edit">
              <div className="absolute bottom-1 inset-x-1 flex justify-end gap-1">
                {!p.isPrimary && (
                  <button type="button" disabled={busy} title={t("listings.photos.makeCover")}
                    onClick={() => setPrimary.mutate({ productId, imageId: p.id })} className={overlayBtn}>
                    <Star className="h-3.5 w-3.5" />
                  </button>
                )}
                <button type="button" disabled={busy} title={t("listings.photos.remove")}
                  onClick={() => remove.mutate({ productId, imageId: p.id })} className={overlayBtn}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </Can>
          </div>
        ))}

        <Can permission="inventory.stock.edit">
          {photos.length < MAX_PHOTOS && (
            <button type="button" disabled={busy || isLoading} onClick={() => inputRef.current?.click()}
              className="aspect-square rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/30 flex flex-col items-center justify-center gap-1 text-muted-foreground text-[11px] font-medium disabled:opacity-50">
              {add.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
              {add.isPending ? t("listings.photos.uploading") : photos.length === 0 ? t("listings.productPhotos.add") : t("listings.photos.addMore")}
            </button>
          )}
        </Can>
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={e => take(e.target.files)} />
    </div>
  );
}
