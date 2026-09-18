import * as React from "react";
import { Paperclip, X, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  ATTACHMENT_MAX_FILES, ATTACHMENT_MAX_SIZE_BYTES, ATTACHMENT_ALLOWED_TYPES,
  type AttachmentInput,
} from "@/lib/support/support.api";

function readAsDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Controlled file picker: validates count/size/type client-side (mirrors TicketAttachmentLimits
 * on the backend — the backend re-validates regardless, this is just a fast, friendly first check),
 * reads each file to a data URI, and hands the resulting list up via onChange. */
export function AttachmentPicker({
  value, onChange, disabled,
}: {
  value: AttachmentInput[];
  onChange: (files: AttachmentInput[]) => void;
  disabled?: boolean;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const incoming = Array.from(fileList);

    if (value.length + incoming.length > ATTACHMENT_MAX_FILES) {
      toast.error(`You can attach at most ${ATTACHMENT_MAX_FILES} files.`);
      return;
    }

    const next: AttachmentInput[] = [...value];
    for (const file of incoming) {
      if (!ATTACHMENT_ALLOWED_TYPES.includes(file.type)) {
        toast.error(`${file.name}: file type not supported.`);
        continue;
      }
      if (file.size > ATTACHMENT_MAX_SIZE_BYTES) {
        toast.error(`${file.name}: must be under ${(ATTACHMENT_MAX_SIZE_BYTES / (1024 * 1024)).toFixed(0)} MB.`);
        continue;
      }
      try {
        const dataUri = await readAsDataUri(file);
        next.push({ fileName: file.name, contentType: file.type, dataUri });
      } catch {
        toast.error(`Could not read ${file.name}.`);
      }
    }
    onChange(next);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ATTACHMENT_ALLOWED_TYPES.join(",")}
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
          disabled={disabled}
        />
        <Button
          type="button" size="sm" variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || value.length >= ATTACHMENT_MAX_FILES}
        >
          <Paperclip className="h-3.5 w-3.5 mr-1.5" /> Attach file
        </Button>
        <span className="text-[11px] text-muted-foreground">
          Up to {ATTACHMENT_MAX_FILES} files, {(ATTACHMENT_MAX_SIZE_BYTES / (1024 * 1024)).toFixed(0)} MB each
        </span>
      </div>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {value.map((f, i) => (
            <div key={`${f.fileName}-${i}`} className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs">
              <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="max-w-[140px] truncate">{f.fileName}</span>
              <span className="text-muted-foreground">
                {formatSize(Math.round((f.dataUri.length - f.dataUri.indexOf(",") - 1) * 3 / 4))}
              </span>
              <button type="button" onClick={() => onChange(value.filter((_, idx) => idx !== i))}
                className="text-muted-foreground hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Renders a message's attachments — image thumbnail for images, a download chip otherwise. */
export function AttachmentList({ attachments }: { attachments: { id: string; fileName: string; contentType: string; dataUri: string; sizeBytes: number }[] }) {
  if (attachments.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {attachments.map(a => a.contentType.startsWith("image/") ? (
        <a key={a.id} href={a.dataUri} download={a.fileName} target="_blank" rel="noreferrer" title={a.fileName}>
          <img src={a.dataUri} alt={a.fileName} className="h-20 w-20 object-cover rounded-lg border border-border" />
        </a>
      ) : (
        <a key={a.id} href={a.dataUri} download={a.fileName}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs hover:bg-muted">
          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="max-w-[160px] truncate">{a.fileName}</span>
          <span className="text-muted-foreground">{formatSize(a.sizeBytes)}</span>
        </a>
      ))}
    </div>
  );
}
