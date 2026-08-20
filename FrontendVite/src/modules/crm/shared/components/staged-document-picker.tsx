import * as React from "react";
import { useTranslation } from "react-i18next";
import { Upload, FileText, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DOCUMENT_TYPES, MAX_DOCUMENT_BYTES, documentTypeLabel, formatFileSize } from "@/lib/crm/documents.api";
import { crmDocumentsApi } from "@/lib/crm/documents.api";
import type { CrmDocumentTarget } from "@/lib/crm/documents.api";

/** A file chosen but not yet uploaded. */
export interface StagedDocument {
  key: string;
  file: File;
  documentType: string;
  description: string;
  /** Set when the file fails a client-side check (currently size); such files are never uploaded. */
  error?: string;
}

/**
 * Monotonic counter for staged-file keys.
 *
 * `${name}-${Date.now()}-${index}` collided: dropping the same file twice in the same millisecond
 * produced two identical keys (both index 0), and duplicate keys make React's reconciliation
 * remove the wrong node — which surfaces as "removeChild: the node to be removed is not a child".
 */
let stagedSeq = 0;

export function makeStaged(file: File, index: number, tooLargeMessage: (f: File) => string): StagedDocument {
  return {
    key: `staged-${++stagedSeq}`,
    file,
    documentType: "contract",
    description: "",
    error: file.size > MAX_DOCUMENT_BYTES ? tooLargeMessage(file) : undefined,
  };
}

/**
 * Uploads staged files against a record that now exists.
 *
 * Used by the create forms, where documents are chosen *before* the lead/account exists and can
 * only be attached once the server has given it an id. Sequential on purpose — each file can be
 * 10 MB, and a parallel burst competes for bandwidth and can trip request limits.
 *
 * Returns the number that failed; callers decide how loudly to report it. A partial failure is
 * deliberately non-fatal: the record itself was created successfully and must not be rolled back
 * just because an attachment did not stick.
 */
export async function uploadStagedDocuments(
  relatedToType: CrmDocumentTarget,
  relatedToId: string,
  staged: StagedDocument[],
): Promise<number> {
  let failed = 0;
  for (const s of staged) {
    if (s.error) continue;
    try {
      await crmDocumentsApi.upload({
        relatedToType,
        relatedToId,
        file: s.file,
        documentType: s.documentType,
        description: s.description.trim() || undefined,
      });
    } catch {
      failed++;
    }
  }
  return failed;
}

interface Props {
  files: StagedDocument[];
  onChange: (files: StagedDocument[]) => void;
  /** Compact hides the section heading — used inside forms that already have their own. */
  className?: string;
}

/**
 * Drop-zone + per-file category/note editor for files that will be uploaded later.
 * Holds no server state of its own; the parent owns the list.
 */
export function StagedDocumentPicker({ files, onChange, className }: Props) {
  const { t } = useTranslation("crm");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);

  const tooLarge = (f: File) =>
    t("documents.tooLarge", {
      defaultValue: "“{{name}}” is {{size}} — the limit is {{max}}.",
      name: f.name, size: formatFileSize(f.size), max: formatFileSize(MAX_DOCUMENT_BYTES),
    });

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    onChange([...files, ...Array.from(list).map((f, i) => makeStaged(f, i, tooLarge))]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const patch = (key: string, p: Partial<StagedDocument>) =>
    onChange(files.map((f) => (f.key === key ? { ...f, ...p } : f)));

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
      className={cn(
        "rounded-xl border border-dashed p-3 space-y-2 transition-colors",
        dragging ? "border-primary bg-primary/5" : "border-border",
        className,
      )}
    >
      <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-full flex flex-col items-center justify-center gap-1 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <Upload className="h-4 w-4" />
        {t("documents.choose", { defaultValue: "Upload a document" })}
        <span className="text-[11px] text-muted-foreground/70">
          {t("documents.dropHint", {
            defaultValue: "or drop files here · up to {{max}} each",
            max: formatFileSize(MAX_DOCUMENT_BYTES),
          })}
        </span>
      </button>

      {files.map((s) => (
        <div key={s.key} className="rounded-lg border border-border p-2 space-y-1.5">
          <div className="flex items-center gap-2 text-sm">
            <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="flex-1 truncate text-foreground">{s.file.name}</span>
            <span className="text-xs text-muted-foreground shrink-0">{formatFileSize(s.file.size)}</span>
            <button
              type="button"
              onClick={() => onChange(files.filter((f) => f.key !== s.key))}
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {s.error ? (
            <p className="text-xs text-destructive">{s.error}</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <select
                value={s.documentType}
                onChange={(e) => patch(s.key, { documentType: e.target.value })}
                className="h-8 text-xs rounded-md border border-border bg-card px-2"
              >
                {DOCUMENT_TYPES.map((dt) => (
                  <option key={dt} value={dt}>{documentTypeLabel(dt)}</option>
                ))}
              </select>
              <Input
                value={s.description}
                onChange={(e) => patch(s.key, { description: e.target.value })}
                placeholder={t("documents.note", { defaultValue: "Note (optional)" })}
                className="h-8 text-xs"
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
