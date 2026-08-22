import * as React from "react";
import { useTranslation } from "react-i18next";
import {
  Upload, Download, Trash2, FileText, FileImage, FileSpreadsheet, File as FileIcon,
  Loader2, X, Pencil, Check, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatDate } from "@/lib/utils";
import { Can, useCan } from "@/components/auth/can";
import {
  useCrmDocuments, useUploadCrmDocument, useUpdateCrmDocument,
  useDeleteCrmDocument, useDownloadCrmDocument,
} from "@/hooks/crm/use-crm-documents";
import {
  DOCUMENT_TYPES, MAX_DOCUMENT_BYTES, documentTypeLabel, formatFileSize, isPreviewable,
} from "@/lib/crm/documents.api";
import type { CrmDocumentDto, CrmDocumentTarget } from "@/lib/crm/documents.api";
import { DocumentPreviewModal } from "./document-preview-modal";
import { makeStaged } from "./staged-document-picker";
import type { StagedDocument } from "./staged-document-picker";

interface Props {
  relatedToType: CrmDocumentTarget;
  relatedToId: string;
}

/** Picks an icon from the MIME type so the list is scannable at a glance. */
export function iconForContentType(contentType: string) {
  if (contentType.startsWith("image/")) return FileImage;
  if (contentType.includes("pdf")) return FileText;
  if (contentType.includes("sheet") || contentType.includes("excel") || contentType.includes("csv"))
    return FileSpreadsheet;
  if (contentType.includes("word") || contentType.startsWith("text/")) return FileText;
  return FileIcon;
}

/** Alias of the shared staged-file shape — the panel and the create forms queue files identically. */
type QueuedFile = StagedDocument;

/**
 * Upload / list / preview / download / rename / delete documents for any CRM record.
 * Shared by the lead, opportunity and account drawers and the document library page.
 */
export function DocumentsPanel({ relatedToType, relatedToId }: Props) {
  const { t } = useTranslation("crm");
  const { data: documents = [], isLoading } = useCrmDocuments(relatedToType, relatedToId);
  const upload = useUploadCrmDocument();
  const update = useUpdateCrmDocument();
  const del = useDeleteCrmDocument();
  const download = useDownloadCrmDocument();

  // Which permission area governs THIS panel. It is shared by the lead, opportunity and account
  // drawers, so gating on crm.leads.edit was wrong twice over: it demanded the LEAD key for
  // opportunity and account attachments, and it checked only the tenant-wide tier — so an owner
  // holding crm.leads-assigned.edit (a rep, on their own lead) had the entire upload UI hidden and
  // uploading simply appeared not to work.
  const area =
    relatedToType === "deal" ? "pipeline"
    : relatedToType === "customer" || relatedToType === "contact" ? "customers"
    : "leads";

  // Called unconditionally — hooks must never sit behind a `||` short-circuit.
  const canEditAll      = useCan(`crm.${area}.edit`);
  const canEditTeam     = useCan(`crm.${area}-team.edit`);
  const canEditAssigned = useCan(`crm.${area}-assigned.edit`);
  // Any tier may attach; the server still decides per record whether this one is actually theirs.
  const canEdit = canEditAll || canEditTeam || canEditAssigned;

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [queue, setQueue] = React.useState<QueuedFile[]>([]);
  const [dragging, setDragging] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState<CrmDocumentDto | null>(null);
  const [editing, setEditing] = React.useState<{ id: string; documentType: string; description: string } | null>(null);
  const [preview, setPreview] = React.useState<CrmDocumentDto | null>(null);

  const addFiles = (files: FileList | File[] | null) => {
    if (!files) return;
    // Checked client-side so an oversized file is never uploaded just to be rejected.
    const tooLarge = (f: File) => t("documents.tooLarge", {
      defaultValue: "“{{name}}” is {{size}} — the limit is {{max}}.",
      name: f.name, size: formatFileSize(f.size), max: formatFileSize(MAX_DOCUMENT_BYTES),
    });
    const next: QueuedFile[] = Array.from(files).map((file, i) => makeStaged(file, i, tooLarge));
    setQueue((prev) => [...prev, ...next]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const patchQueued = (key: string, patch: Partial<QueuedFile>) =>
    setQueue((prev) => prev.map((q) => (q.key === key ? { ...q, ...patch } : q)));

  const uploadable = queue.filter((q) => !q.error);

  const handleUploadAll = async () => {
    // Sequential rather than parallel: each file can be up to 10 MB, and firing a whole batch at
    // once would compete for bandwidth and can trip request limits.
    for (const q of uploadable) {
      try {
        await upload.mutateAsync({
          relatedToType, relatedToId,
          file: q.file,
          documentType: q.documentType,
          description: q.description.trim() || undefined,
        });
        setQueue((prev) => prev.filter((x) => x.key !== q.key));
      } catch {
        // The hook already toasts. Keep the file queued so it can be retried.
        patchQueued(q.key, { error: t("documents.uploadFailed", { defaultValue: "Upload failed — try again." }) });
      }
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (!canEdit) return;
    addFiles(e.dataTransfer.files);
  };

  return (
    <div className="space-y-3">
      <Can anyOf={[`crm.${area}.edit`, `crm.${area}-team.edit`, `crm.${area}-assigned.edit`]}>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "rounded-xl border border-dashed p-3 space-y-2 transition-colors",
            dragging ? "border-primary bg-primary/5" : "border-border",
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex flex-col items-center justify-center gap-1 py-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
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

          {queue.length > 0 && (
            <div className="space-y-2 pt-1">
              {queue.map((q) => (
                <div key={q.key} className="rounded-lg border border-border p-2 space-y-1.5">
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="flex-1 truncate text-foreground">{q.file.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{formatFileSize(q.file.size)}</span>
                    <button
                      onClick={() => setQueue((prev) => prev.filter((x) => x.key !== q.key))}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {q.error ? (
                    <p className="text-xs text-destructive">{q.error}</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={q.documentType}
                        onChange={(e) => patchQueued(q.key, { documentType: e.target.value })}
                        className="h-8 text-xs rounded-md border border-border bg-card px-2"
                      >
                        {DOCUMENT_TYPES.map((dt) => (
                          <option key={dt} value={dt}>{documentTypeLabel(dt)}</option>
                        ))}
                      </select>
                      <Input
                        value={q.description}
                        onChange={(e) => patchQueued(q.key, { description: e.target.value })}
                        placeholder={t("documents.note", { defaultValue: "Note (optional)" })}
                        className="h-8 text-xs"
                      />
                    </div>
                  )}
                </div>
              ))}

              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => setQueue([])}>
                  {t("common:action.cancel", { defaultValue: "Cancel" })}
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  disabled={upload.isPending || uploadable.length === 0}
                  onClick={handleUploadAll}
                >
                  {upload.isPending
                    ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />{t("documents.uploading", { defaultValue: "Uploading…" })}</>
                    : <><Upload className="h-3.5 w-3.5 mr-1.5" />{t("documents.uploadCount", { defaultValue: "Upload {{count}}", count: uploadable.length })}</>}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Can>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : documents.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          {t("documents.empty", { defaultValue: "No documents attached yet." })}
        </p>
      ) : (
        <div className="space-y-1.5">
          {documents.map((doc) => {
            const Icon = iconForContentType(doc.contentType);
            const isEditing = editing?.id === doc.id;

            return (
              <div
                key={doc.id}
                className="rounded-lg border border-border px-3 py-2 hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className="text-sm text-foreground truncate">{doc.fileName}</p>
                      {/* An account rolls up its opportunities', contacts' and originating leads'
                          documents — chip the ones from elsewhere so their origin is obvious. */}
                      {doc.relatedToType !== relatedToType && (
                        <span
                          title={doc.relatedToName ?? undefined}
                          className="shrink-0 px-1.5 py-0.5 rounded-full bg-muted/50 text-[10px] font-medium text-muted-foreground"
                        >
                          {t(`documents.origin.${doc.relatedToType}`, { defaultValue: doc.relatedToType })}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      <span className="text-primary">{documentTypeLabel(doc.documentType)}</span>
                      {" · "}{formatFileSize(doc.sizeBytes)}
                      {" · "}{formatDate(doc.createdAt)}
                      {doc.uploadedByName ? ` · ${doc.uploadedByName}` : ""}
                    </p>
                    {doc.description && !isEditing && (
                      <p className="text-[11px] text-muted-foreground/80 truncate italic">{doc.description}</p>
                    )}
                  </div>

                  {isPreviewable(doc.contentType) && (
                    <button
                      onClick={() => setPreview(doc)}
                      title={t("documents.preview", { defaultValue: "Preview" })}
                      className="p-1.5 rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground shrink-0"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => download.mutate(doc)}
                    disabled={download.isPending}
                    title={t("documents.download", { defaultValue: "Download" })}
                    className="p-1.5 rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground shrink-0"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                  <Can anyOf={[`crm.${area}.edit`, `crm.${area}-team.edit`, `crm.${area}-assigned.edit`]}>
                    <button
                      onClick={() => setEditing(isEditing ? null : {
                        id: doc.id, documentType: doc.documentType, description: doc.description ?? "",
                      })}
                      title={t("documents.edit", { defaultValue: "Edit details" })}
                      className="p-1.5 rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground shrink-0"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(doc)}
                      title={t("documents.delete", { defaultValue: "Delete" })}
                      className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </Can>
                </div>

                {isEditing && editing && (
                  <div className="mt-2 flex items-center gap-2 pt-2 border-t border-border">
                    <select
                      value={editing.documentType}
                      onChange={(e) => setEditing({ ...editing, documentType: e.target.value })}
                      className="h-8 text-xs rounded-md border border-border bg-card px-2"
                    >
                      {DOCUMENT_TYPES.map((dt) => (
                        <option key={dt} value={dt}>{documentTypeLabel(dt)}</option>
                      ))}
                    </select>
                    <Input
                      value={editing.description}
                      onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                      placeholder={t("documents.note", { defaultValue: "Note (optional)" })}
                      className="h-8 text-xs flex-1"
                    />
                    <Button
                      size="sm"
                      className="h-8"
                      disabled={update.isPending}
                      onClick={() =>
                        update.mutate(
                          { id: editing.id, documentType: editing.documentType, description: editing.description.trim() || null },
                          { onSuccess: () => setEditing(null) },
                        )
                      }
                    >
                      {update.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {preview && (
        <DocumentPreviewModal
          doc={preview}
          onClose={() => setPreview(null)}
          onDownload={() => download.mutate(preview)}
        />
      )}

      {/* State-based confirmation — the project never uses window.confirm. */}
      {confirmDelete && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-xl border border-border bg-card p-4 space-y-3">
            <p className="text-sm font-semibold text-foreground">
              {t("documents.confirmTitle", { defaultValue: "Delete document?" })}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("documents.confirmBody", {
                defaultValue: "“{{name}}” will be removed. This can't be undone.",
                name: confirmDelete.fileName,
              })}
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(null)}>
                {t("common:action.cancel", { defaultValue: "Cancel" })}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={del.isPending}
                onClick={() => del.mutate(confirmDelete.id, { onSuccess: () => setConfirmDelete(null) })}
              >
                {del.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                {t("documents.delete", { defaultValue: "Delete" })}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
