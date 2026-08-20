import * as React from "react";
import { motion } from "framer-motion";
import {
  Folder, File, FileText, FileImage, FileSpreadsheet, FileVideo,
  Search, Grid3X3, List, Download, Eye, HardDrive, Loader2, Info,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn, formatDate } from "@/lib/utils";
import { useCan } from "@/components/auth/can";
import { useCrmDocumentLibrary, useDownloadCrmDocument } from "@/hooks/crm/use-crm-documents";
import { documentTypeLabel, formatFileSize, isPreviewable } from "@/lib/crm/documents.api";
import type { CrmDocumentDto } from "@/lib/crm/documents.api";
import { DocumentPreviewModal } from "@/modules/crm/shared/components/document-preview-modal";

/**
 * File Manager — every file actually stored in the product.
 *
 * <p>This screen used to render 16 invented files ("Q1-2026-P&L-Statement.pdf", "Board-Meeting.mp4"
 * …), fabricated folders and a hardcoded "38.4 GB of 100 GB used" storage bar. None of it existed:
 * there is no file-manager backend, so every tenant saw the same fictional drive. It now reads the
 * one real document store in the product — CRM attachments — and shows an honest empty state when
 * the tenant has uploaded nothing.</p>
 *
 * <p><b>Scope, stated plainly:</b> only CRM record attachments exist today. Finance, HR, Purchase
 * and the industry packs have no file storage, so nothing from them can appear here yet.</p>
 */

const FILE_ICONS: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  pdf:    { icon: FileText,        color: "text-destructive",  bg: "bg-destructive/10" },
  excel:  { icon: FileSpreadsheet, color: "text-success",      bg: "bg-success/10" },
  image:  { icon: FileImage,       color: "text-primary",      bg: "bg-primary/10" },
  word:   { icon: FileText,        color: "text-blue-600",     bg: "bg-blue-50 dark:bg-blue-900/20" },
  video:  { icon: FileVideo,       color: "text-purple-600",   bg: "bg-purple-50 dark:bg-purple-900/20" },
  other:  { icon: File,            color: "text-muted-foreground", bg: "bg-muted" },
};

function kindOf(contentType: string): keyof typeof FILE_ICONS {
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("video/")) return "video";
  if (contentType.includes("pdf")) return "pdf";
  if (contentType.includes("sheet") || contentType.includes("excel") || contentType.includes("csv")) return "excel";
  if (contentType.includes("word") || contentType.startsWith("text/")) return "word";
  return "other";
}

export function FileManagerView() {
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [viewMode, setViewMode] = React.useState<"grid" | "list">("grid");
  const [category, setCategory] = React.useState("All");
  const [preview, setPreview] = React.useState<CrmDocumentDto | null>(null);

  // Reading the library needs CRM view rights. Without them the query is never issued, so a
  // restricted user gets the empty state instead of a 403 and an error toast.
  const canRead = useCan("crm.leads.view") || useCan("crm.leads-team.view") || useCan("crm.leads-assigned.view");

  React.useEffect(() => {
    const handle = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(handle);
  }, [search]);

  const { data: documents = [], isLoading } = useCrmDocumentLibrary(
    { search: debounced || undefined },
    canRead,
  );
  const download = useDownloadCrmDocument();

  // Categories come from the files themselves — no fixed folder list to drift out of sync.
  const categories = React.useMemo(
    () => ["All", ...[...new Set(documents.map(d => d.documentType))].sort()],
    [documents],
  );

  const filtered = React.useMemo(
    () => (category === "All" ? documents : documents.filter(d => d.documentType === category)),
    [documents, category],
  );

  const totalBytes = React.useMemo(
    () => documents.reduce((sum, d) => sum + d.sizeBytes, 0),
    [documents],
  );

  const showEmpty = !isLoading && documents.length === 0;

  return (
    <div className="space-y-5">
      {/* Header — no "New Folder"/"Upload" buttons: there is no generic upload target. Files are
          attached to a CRM record from that record's Documents tab. */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">File Manager</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Documents attached across your CRM records
          </p>
        </div>
        {!showEmpty && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode("grid")}
              className={cn("p-2 rounded-lg", viewMode === "grid" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/40")}
            >
              <Grid3X3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn("p-2 rounded-lg", viewMode === "list" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/40")}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : showEmpty ? (
        <div className="bg-card border border-border rounded-xl py-20 px-6 text-center">
          <HardDrive className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-semibold text-foreground">No files yet</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            {canRead
              ? "Files appear here once you attach documents to a lead, opportunity or account — open a record and use its Documents tab."
              : "You don't have permission to view stored documents."}
          </p>
        </div>
      ) : (
        <>
          {/* Real counts and real bytes — there is no storage quota in the product, so none is shown. */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: "Files", value: String(documents.length), icon: File, color: "text-primary", bg: "bg-primary/10" },
              { label: "Categories", value: String(Math.max(categories.length - 1, 0)), icon: Folder, color: "text-warning", bg: "bg-warning/10" },
              { label: "Total size", value: formatFileSize(totalBytes), icon: HardDrive, color: "text-success", bg: "bg-success/10" },
            ].map((s, i) => {
              const Icon = s.icon;
              return (
                <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                  className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                  <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", s.bg)}>
                    <Icon className={cn("h-5 w-5", s.color)} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className="font-bold text-lg leading-tight">{s.value}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search files…"
                className="pl-9 h-9 text-sm"
              />
            </div>
            <div className="flex gap-1.5 overflow-x-auto">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap",
                    category === c ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground hover:bg-muted/50",
                  )}
                >
                  {c === "All" ? "All" : documentTypeLabel(c)}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-16">No files match those filters.</p>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filtered.map((doc) => {
                const cfg = FILE_ICONS[kindOf(doc.contentType)];
                const Icon = cfg.icon;
                return (
                  <div key={doc.id} className="bg-card border border-border rounded-xl p-4 hover:border-primary/40 transition-colors group">
                    <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center mb-3", cfg.bg)}>
                      <Icon className={cn("h-5 w-5", cfg.color)} />
                    </div>
                    <p className="text-sm font-medium text-foreground truncate" title={doc.fileName}>{doc.fileName}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      {documentTypeLabel(doc.documentType)} · {formatFileSize(doc.sizeBytes)}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">{doc.relatedToName ?? "—"}</p>
                    <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {isPreviewable(doc.contentType) && (
                        <button onClick={() => setPreview(doc)} title="Preview"
                          className="p-1.5 rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground">
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button onClick={() => download.mutate(doc)} title="Download"
                        className="p-1.5 rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground">
                        <Download className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      {["Name", "Category", "Record", "Size", "Uploaded", ""].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((doc) => {
                      const cfg = FILE_ICONS[kindOf(doc.contentType)];
                      const Icon = cfg.icon;
                      return (
                        <tr key={doc.id} className="border-b border-border last:border-0 hover:bg-muted/10">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <Icon className={cn("h-4 w-4 shrink-0", cfg.color)} />
                              <span className="text-sm text-foreground truncate">{doc.fileName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-primary whitespace-nowrap">{documentTypeLabel(doc.documentType)}</td>
                          <td className="px-4 py-2.5 text-xs text-foreground truncate">{doc.relatedToName ?? "—"}</td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{formatFileSize(doc.sizeBytes)}</td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{formatDate(doc.createdAt)}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1 justify-end">
                              {isPreviewable(doc.contentType) && (
                                <button onClick={() => setPreview(doc)} title="Preview"
                                  className="p-1.5 rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground">
                                  <Eye className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <button onClick={() => download.mutate(doc)} title="Download"
                                className="p-1.5 rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground">
                                <Download className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Info className="h-3 w-3 shrink-0" />
            Only CRM record attachments are stored today — other modules do not yet have file storage.
          </p>
        </>
      )}

      {preview && (
        <DocumentPreviewModal
          doc={preview}
          onClose={() => setPreview(null)}
          onDownload={() => download.mutate(preview)}
        />
      )}
    </div>
  );
}
