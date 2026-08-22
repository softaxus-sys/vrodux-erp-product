import * as React from "react";
import { motion } from "framer-motion";
import {
  Folder, File, FileText, FileImage, FileSpreadsheet, FileVideo,
  Search, Grid3X3, List, Download, Eye, HardDrive, Loader2, Info,
  ChevronRight, Home, User, Handshake, CornerLeftUp,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn, formatDate } from "@/lib/utils";
import { useCan } from "@/components/auth/can";
import { useAuthStore } from "@/store/auth.store";
import { useCrmDocumentLibrary, useDownloadCrmDocument } from "@/hooks/crm/use-crm-documents";
import { documentTypeLabel, formatFileSize, isPreviewable } from "@/lib/crm/documents.api";
import type { CrmDocumentDto } from "@/lib/crm/documents.api";
import { DocumentPreviewModal } from "@/modules/crm/shared/components/document-preview-modal";

/**
 * File Manager — every file actually stored in the product, browsable as folders.
 *
 * <p>Structure: <b>Module → Record owner → Document type → files</b>. The owner level is the rep who
 * owns the linked lead/opportunity/account, <i>not</i> whoever uploaded the file — a manager
 * uploading a contract onto a rep's deal still files under that rep, so a rep's folder reflects
 * their actual book of business.</p>
 *
 * <p><b>Visibility</b> is the CRM access tier, enforced server-side: an admin sees every rep's
 * folder, a team lead sees their team's, a rep sees only their own. The client never filters for
 * security — it only lays out what the API returned.</p>
 *
 * <p><b>Scope, stated plainly:</b> only CRM record attachments exist today. Finance stores a single
 * receipt blob per expense (not a document library), Visa stores a document URL rather than a file,
 * and HR / Purchase / Sales / Inventory have no file storage at all — so nothing from them can
 * appear here yet.</p>
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

/** Bucket for documents whose linked record has no owner — never silently dropped. */
const UNASSIGNED = "__unassigned__";

interface FolderPath {
  module?: string;   // "crm"
  owner?:  string;   // ownerUserId, or UNASSIGNED
  type?:   string;   // documentType
}

export function FileManagerView() {
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [viewMode, setViewMode] = React.useState<"grid" | "list">("grid");
  const [path, setPath] = React.useState<FolderPath>({});
  const [preview, setPreview] = React.useState<CrmDocumentDto | null>(null);

  const hasModuleAccess = useAuthStore(s => s.hasModuleAccess);
  const currentUserId = useAuthStore(s => s.user?.id);

  // Opening File Manager requires only its OWN permission — `file-manager.view`, enforced by the
  // route guard. It must never demand CRM permissions: it is a separate module, and a tenant or user
  // without CRM should still get a working (empty) file browser rather than a permission error.
  //
  // What it *shows* is a different question: today the only document store in the product is CRM's,
  // so the query is issued only when the user has some CRM view tier. Without one there is simply
  // nothing to list — an empty state, not "you don't have permission".
  const canReadCrmDocs =
    (useCan("crm.leads.view") || useCan("crm.leads-team.view") || useCan("crm.leads-assigned.view") ||
     useCan("crm.pipeline.view") || useCan("crm.pipeline-team.view") || useCan("crm.pipeline-assigned.view") ||
     useCan("crm.customers.view") || useCan("crm.customers-team.view") || useCan("crm.customers-assigned.view"))
    && hasModuleAccess("crm");
  const canExport = useCan("file-manager.export");

  React.useEffect(() => {
    const handle = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(handle);
  }, [search]);

  const { data: documents = [], isLoading } = useCrmDocumentLibrary(
    { search: debounced || undefined },
    canReadCrmDocs,
  );
  const download = useDownloadCrmDocument();

  // Searching flattens the tree — hunting for a file by name should not require knowing which
  // folder it lives in. Standard file-manager behaviour.
  const searching = debounced.trim().length > 0;

  // ── Folder model ─────────────────────────────────────────────────────────
  // Modules are listed from what the tenant actually has AND what holds files. Only CRM has a
  // document store, so listing others would be advertising empty drawers.
  const modules = React.useMemo(
    () => (hasModuleAccess("crm") ? [{ id: "crm", label: "CRM", icon: Handshake }] : []),
    [hasModuleAccess],
  );

  const ownerKey = (d: CrmDocumentDto) => d.ownerUserId ?? UNASSIGNED;
  const ownerLabel = (d: CrmDocumentDto) =>
    d.ownerName?.trim() || (d.ownerUserId ? "Unnamed user" : "Unassigned");

  const owners = React.useMemo(() => {
    const map = new Map<string, { key: string; label: string; count: number; bytes: number }>();
    for (const d of documents) {
      const key = ownerKey(d);
      const row = map.get(key) ?? { key, label: ownerLabel(d), count: 0, bytes: 0 };
      row.count++; row.bytes += d.sizeBytes;
      map.set(key, row);
    }
    // Your own folder first — the one a rep opens most; then by volume.
    return [...map.values()].sort((a, b) => {
      if (currentUserId && a.key === currentUserId) return -1;
      if (currentUserId && b.key === currentUserId) return 1;
      return b.count - a.count;
    });
  }, [documents, currentUserId]);

  const ownerDocs = React.useMemo(
    () => (path.owner ? documents.filter(d => ownerKey(d) === path.owner) : []),
    [documents, path.owner],
  );

  const types = React.useMemo(() => {
    const map = new Map<string, { key: string; count: number; bytes: number }>();
    for (const d of ownerDocs) {
      const row = map.get(d.documentType) ?? { key: d.documentType, count: 0, bytes: 0 };
      row.count++; row.bytes += d.sizeBytes;
      map.set(d.documentType, row);
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [ownerDocs]);

  const files = React.useMemo(() => {
    if (searching) return documents;
    if (!path.type) return [];
    return ownerDocs.filter(d => d.documentType === path.type);
  }, [searching, documents, ownerDocs, path.type]);

  const totalBytes = React.useMemo(
    () => documents.reduce((sum, d) => sum + d.sizeBytes, 0),
    [documents],
  );

  const showEmpty = !isLoading && documents.length === 0 && !searching;

  const level: "modules" | "owners" | "types" | "files" =
    searching       ? "files"
    : !path.module  ? "modules"
    : !path.owner   ? "owners"
    : !path.type    ? "types"
    :                 "files";

  const ownerName = owners.find(o => o.key === path.owner)?.label;

  // ── Renderers ────────────────────────────────────────────────────────────

  const FolderCard = ({
    label, sublabel, icon: Icon, onOpen, index,
  }: {
    label: string; sublabel: string; icon: React.ElementType; onOpen: () => void; index: number;
  }) => (
    <motion.button
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.25) }}
      onClick={onOpen}
      className="text-start bg-card border border-border rounded-xl p-4 hover:border-primary/40 hover:shadow-sm transition-all"
    >
      <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center mb-3">
        <Icon className="h-5 w-5 text-warning" />
      </div>
      <p className="text-sm font-semibold truncate" title={label}>{label}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5">{sublabel}</p>
    </motion.button>
  );

  const FileActions = ({ doc }: { doc: CrmDocumentDto }) => (
    <>
      {isPreviewable(doc.contentType) && (
        <button onClick={() => setPreview(doc)} title="Preview"
          className="p-1.5 rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground">
          <Eye className="h-3.5 w-3.5" />
        </button>
      )}
      {/* Taking a copy of a file off the system is a separate decision from being able to look at
          it, so downloading has its own key rather than riding on view. */}
      {canExport && (
        <button onClick={() => download.mutate(doc)} title="Download"
          className="p-1.5 rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground">
          <Download className="h-3.5 w-3.5" />
        </button>
      )}
    </>
  );

  return (
    <div className="space-y-5">
      {/* Header — no "New Folder"/"Upload": there is no generic upload target. Files are attached
          to a CRM record from that record's Documents tab, and folders are derived, not created. */}
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
            {canReadCrmDocs
              ? "Files appear here once you attach documents to a lead, opportunity or account — open a record and use its Documents tab."
              // Not a permission failure for File Manager itself — there is simply no document store
              // this user can read, since CRM is currently the only module that stores files.
              : "There are no document libraries available to you yet."}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: "Files", value: String(documents.length), icon: File, color: "text-primary", bg: "bg-primary/10" },
              { label: "Owners", value: String(owners.length), icon: User, color: "text-warning", bg: "bg-warning/10" },
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

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search all files…"
              className="pl-9 h-9 text-sm"
            />
          </div>

          {/* Breadcrumbs — hidden while searching, since results span every folder. */}
          {!searching && (
            <div className="flex items-center gap-1 text-sm flex-wrap">
              <button onClick={() => setPath({})}
                className={cn("flex items-center gap-1 px-2 py-1 rounded-md hover:bg-muted/40",
                  !path.module ? "font-semibold" : "text-muted-foreground")}>
                <Home className="h-3.5 w-3.5" /> All files
              </button>
              {path.module && (
                <>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground rtl:rotate-180" />
                  <button onClick={() => setPath({ module: path.module })}
                    className={cn("px-2 py-1 rounded-md hover:bg-muted/40",
                      !path.owner ? "font-semibold" : "text-muted-foreground")}>
                    CRM
                  </button>
                </>
              )}
              {path.owner && (
                <>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground rtl:rotate-180" />
                  <button onClick={() => setPath({ module: path.module, owner: path.owner })}
                    className={cn("px-2 py-1 rounded-md hover:bg-muted/40",
                      !path.type ? "font-semibold" : "text-muted-foreground")}>
                    {ownerName ?? "—"}
                  </button>
                </>
              )}
              {path.type && (
                <>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground rtl:rotate-180" />
                  <span className="px-2 py-1 font-semibold">{documentTypeLabel(path.type)}</span>
                </>
              )}

              {path.module && (
                <button
                  onClick={() => setPath(p => p.type ? { module: p.module, owner: p.owner } : p.owner ? { module: p.module } : {})}
                  className="ms-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted/40"
                >
                  <CornerLeftUp className="h-3.5 w-3.5" /> Up
                </button>
              )}
            </div>
          )}

          {/* ── Level: modules ── */}
          {level === "modules" && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {modules.map((m, i) => (
                <FolderCard
                  key={m.id} index={i} icon={m.icon} label={m.label}
                  sublabel={`${documents.length} ${documents.length === 1 ? "file" : "files"}`}
                  onOpen={() => setPath({ module: m.id })}
                />
              ))}
            </div>
          )}

          {/* ── Level: owners ── */}
          {level === "owners" && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {owners.map((o, i) => (
                <FolderCard
                  key={o.key} index={i} icon={User}
                  label={o.key === currentUserId ? `${o.label} (you)` : o.label}
                  sublabel={`${o.count} ${o.count === 1 ? "file" : "files"} · ${formatFileSize(o.bytes)}`}
                  onOpen={() => setPath({ module: path.module, owner: o.key })}
                />
              ))}
            </div>
          )}

          {/* ── Level: document types ── */}
          {level === "types" && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {types.map((t, i) => (
                <FolderCard
                  key={t.key} index={i} icon={Folder} label={documentTypeLabel(t.key)}
                  sublabel={`${t.count} ${t.count === 1 ? "file" : "files"} · ${formatFileSize(t.bytes)}`}
                  onOpen={() => setPath({ module: path.module, owner: path.owner, type: t.key })}
                />
              ))}
            </div>
          )}

          {/* ── Level: files ── */}
          {level === "files" && (
            files.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-16">
                {searching ? "No files match your search." : "This folder is empty."}
              </p>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {files.map((doc) => {
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
                      {/* While searching the folder context is gone, so name the owner on the card. */}
                      {searching && (
                        <p className="text-[11px] text-muted-foreground truncate">{ownerLabel(doc)}</p>
                      )}
                      <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <FileActions doc={doc} />
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
                        {["Name", "Category", "Owner", "Record", "Size", "Uploaded", ""].map((h) => (
                          <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {files.map((doc) => {
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
                            <td className="px-4 py-2.5 text-xs text-foreground truncate">{ownerLabel(doc)}</td>
                            <td className="px-4 py-2.5 text-xs text-foreground truncate">{doc.relatedToName ?? "—"}</td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{formatFileSize(doc.sizeBytes)}</td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{formatDate(doc.createdAt)}</td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-1 justify-end">
                                <FileActions doc={doc} />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}

          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Info className="h-3 w-3 shrink-0" />
            Folders group by the owner of the linked record, not the uploader. Only CRM record
            attachments are stored today — other modules do not yet have file storage.
          </p>
        </>
      )}

      {/* onDownload carries the same gate as the row action — otherwise the preview modal would be
          a way to download without the export permission. */}
      {preview && (
        <DocumentPreviewModal
          doc={preview}
          onClose={() => setPreview(null)}
          onDownload={canExport ? () => download.mutate(preview) : undefined}
        />
      )}
    </div>
  );
}
