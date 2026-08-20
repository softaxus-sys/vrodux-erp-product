import * as React from "react";
import { useTranslation } from "react-i18next";
import { Search, Download, Eye, FolderOpen, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn, formatDate } from "@/lib/utils";
import { useLazyList } from "@/hooks/use-lazy-list";
import { useCrmDocumentLibrary, useDownloadCrmDocument } from "@/hooks/crm/use-crm-documents";
import {
  DOCUMENT_TYPES, documentTypeLabel, formatFileSize, isPreviewable,
} from "@/lib/crm/documents.api";
import type { CrmDocumentDto, CrmDocumentTarget } from "@/lib/crm/documents.api";
import { iconForContentType } from "@/modules/crm/shared/components/documents-panel";
import { DocumentPreviewModal } from "@/modules/crm/shared/components/document-preview-modal";

const RECORD_TYPES: CrmDocumentTarget[] = ["lead", "deal", "customer", "contact"];

/**
 * Tenant-wide document library — every CRM attachment in one searchable place, so a user can find
 * "all signed contracts" without opening records one at a time.
 */
export function DocumentsLibraryView() {
  const { t } = useTranslation("crm");
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [documentType, setDocumentType] = React.useState<string>("");
  const [relatedToType, setRelatedToType] = React.useState<CrmDocumentTarget | "">("");
  const [preview, setPreview] = React.useState<CrmDocumentDto | null>(null);

  // Debounce so typing doesn't fire a request per keystroke.
  React.useEffect(() => {
    const handle = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(handle);
  }, [search]);

  const { data: documents = [], isLoading } = useCrmDocumentLibrary({
    search: debounced || undefined,
    documentType: documentType || undefined,
    relatedToType: relatedToType || undefined,
  });
  const download = useDownloadCrmDocument();

  const { visible, hasMore, loadMore, sentinelRef, shown, total } = useLazyList(documents, 30);

  const totalSize = React.useMemo(
    () => documents.reduce((sum, d) => sum + d.sizeBytes, 0),
    [documents],
  );

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <FolderOpen className="h-5 w-5 text-primary" />
          {t("documents.libraryTitle", { defaultValue: "Documents" })}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("documents.librarySubtitle", {
            defaultValue: "Every file attached across leads, opportunities, accounts and contacts.",
          })}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("documents.searchPlaceholder", { defaultValue: "Search files, notes or records…" })}
            className="pl-9 h-9 text-sm"
          />
        </div>

        <select
          value={documentType}
          onChange={(e) => setDocumentType(e.target.value)}
          className="h-9 text-sm rounded-md border border-border bg-card px-2"
        >
          <option value="">{t("documents.allCategories", { defaultValue: "All categories" })}</option>
          {DOCUMENT_TYPES.map((dt) => (
            <option key={dt} value={dt}>{documentTypeLabel(dt)}</option>
          ))}
        </select>

        <select
          value={relatedToType}
          onChange={(e) => setRelatedToType(e.target.value as CrmDocumentTarget | "")}
          className="h-9 text-sm rounded-md border border-border bg-card px-2"
        >
          <option value="">{t("documents.allRecords", { defaultValue: "All record types" })}</option>
          {RECORD_TYPES.map((rt) => (
            <option key={rt} value={rt}>{t(`documents.origin.${rt}`, { defaultValue: rt })}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : documents.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-16">
          {t("documents.libraryEmpty", { defaultValue: "No documents match those filters." })}
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {t("documents.libraryCount", {
              defaultValue: "{{count}} documents · {{size}} total",
              count: total, size: formatFileSize(totalSize),
            })}
          </p>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    {["file", "category", "record", "size", "uploaded", ""].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">
                        {h ? t(`documents.col.${h}`, { defaultValue: h }) : ""}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((doc) => {
                    const Icon = iconForContentType(doc.contentType);
                    return (
                      <tr key={doc.id} className="border-b border-border last:border-0 hover:bg-muted/10">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm text-foreground truncate">{doc.fileName}</p>
                              {doc.description && (
                                <p className="text-[11px] text-muted-foreground truncate italic">{doc.description}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-primary whitespace-nowrap">
                          {documentTypeLabel(doc.documentType)}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-foreground">
                          <span className="px-1.5 py-0.5 rounded-full bg-muted/50 text-[10px] text-muted-foreground mr-1.5">
                            {t(`documents.origin.${doc.relatedToType}`, { defaultValue: doc.relatedToType })}
                          </span>
                          {doc.relatedToName ?? "—"}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                          {formatFileSize(doc.sizeBytes)}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(doc.createdAt)}
                          {doc.uploadedByName ? ` · ${doc.uploadedByName}` : ""}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1 justify-end">
                            {isPreviewable(doc.contentType) && (
                              <button
                                onClick={() => setPreview(doc)}
                                title={t("documents.preview", { defaultValue: "Preview" })}
                                className="p-1.5 rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => download.mutate(doc)}
                              disabled={download.isPending}
                              title={t("documents.download", { defaultValue: "Download" })}
                              className="p-1.5 rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                            >
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

          {hasMore && (
            <div ref={sentinelRef} className="flex justify-center py-3">
              <button onClick={loadMore} className={cn("text-xs text-primary hover:underline")}>
                {t("documents.loadMore", { defaultValue: "Load more" })}
              </button>
            </div>
          )}
          <p className="text-center text-[11px] text-muted-foreground">
            {t("documents.shownOf", { defaultValue: "{{shown}} of {{total}}", shown, total })}
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
