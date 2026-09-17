import * as React from "react";
import { ImagePlus, Loader2, Star, Trash2, X } from "lucide-react";
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
              <img
                src={reApi.propertyImageUrl(propertyId!, img.id)}
                alt={img.fileName ?? "Property photo"}
                className="h-full w-full object-cover"
                loading="lazy"
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
