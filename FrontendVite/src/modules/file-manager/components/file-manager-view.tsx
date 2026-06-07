import * as React from "react";
import { motion } from "framer-motion";
import {
  Folder, File, FileText, FileImage, FileSpreadsheet, FileVideo,
  Upload, Plus, Search, Grid3X3, List, MoreHorizontal, Download,
  Trash2, Share2, Star, ChevronRight, HardDrive, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface FileItem {
  id: string;
  name: string;
  type: "folder" | "pdf" | "excel" | "image" | "word" | "video" | "other";
  size: string;
  modified: string;
  starred: boolean;
  shared: boolean;
  module: string;
}

const MOCK_FILES: FileItem[] = [
  // Folders
  { id: "f1", name: "Finance Documents", type: "folder", size: "148 files", modified: "Today", starred: true, shared: false, module: "Finance" },
  { id: "f2", name: "Purchase Orders", type: "folder", size: "64 files", modified: "Yesterday", starred: false, shared: true, module: "Purchase" },
  { id: "f3", name: "Construction BOQs", type: "folder", size: "38 files", modified: "2 days ago", starred: false, shared: true, module: "Construction" },
  { id: "f4", name: "HR Policies", type: "folder", size: "22 files", modified: "Last week", starred: true, shared: false, module: "HR" },
  { id: "f5", name: "Real Estate Contracts", type: "folder", size: "91 files", modified: "Today", starred: false, shared: true, module: "Real Estate" },
  // Files
  { id: "f6", name: "Q1-2026-P&L-Statement.pdf", type: "pdf", size: "2.4 MB", modified: "2026-05-15", starred: true, shared: false, module: "Finance" },
  { id: "f7", name: "Invoice-INV-2026-0412.pdf", type: "pdf", size: "184 KB", modified: "2026-05-12", starred: false, shared: false, module: "Finance" },
  { id: "f8", name: "Vendor-Master-List.xlsx", type: "excel", size: "1.8 MB", modified: "2026-05-10", starred: false, shared: true, module: "Purchase" },
  { id: "f9", name: "Stock-Valuation-May-2026.xlsx", type: "excel", size: "3.2 MB", modified: "2026-05-20", starred: true, shared: false, module: "Inventory" },
  { id: "f10", name: "Palm-Jumeirah-Site-Progress.jpg", type: "image", size: "8.6 MB", modified: "2026-05-18", starred: false, shared: false, module: "Construction" },
  { id: "f11", name: "Employee-Handbook-v3.docx", type: "word", size: "4.1 MB", modified: "2026-04-30", starred: false, shared: true, module: "HR" },
  { id: "f12", name: "BOQ-BusinessBay-Tower.xlsx", type: "excel", size: "2.9 MB", modified: "2026-05-08", starred: false, shared: true, module: "Construction" },
  { id: "f13", name: "Lease-Contract-BV-2024-038.pdf", type: "pdf", size: "890 KB", modified: "2026-05-01", starred: false, shared: false, module: "Real Estate" },
  { id: "f14", name: "Board-Meeting-May-2026.mp4", type: "video", size: "1.2 GB", modified: "2026-05-16", starred: false, shared: false, module: "General" },
  { id: "f15", name: "Annual-Budget-2026.xlsx", type: "excel", size: "5.4 MB", modified: "2026-01-15", starred: true, shared: true, module: "Finance" },
  { id: "f16", name: "VAT-Return-Q1-2026.pdf", type: "pdf", size: "340 KB", modified: "2026-04-28", starred: false, shared: false, module: "Finance" },
];

const FILE_ICONS: Record<FileItem["type"], { icon: React.ElementType; color: string; bg: string }> = {
  folder: { icon: Folder, color: "text-warning", bg: "bg-warning/10" },
  pdf:    { icon: FileText, color: "text-destructive", bg: "bg-destructive/10" },
  excel:  { icon: FileSpreadsheet, color: "text-success", bg: "bg-success/10" },
  image:  { icon: FileImage, color: "text-primary", bg: "bg-primary/10" },
  word:   { icon: FileText, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20" },
  video:  { icon: FileVideo, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-900/20" },
  other:  { icon: File, color: "text-muted-foreground", bg: "bg-muted" },
};

const MODULE_FILTERS = ["All", "Finance", "Purchase", "Inventory", "HR", "Real Estate", "Construction", "General"];

const STORAGE_USED = 38.4;
const STORAGE_TOTAL = 100;

export function FileManagerView() {
  const [search, setSearch] = React.useState("");
  const [viewMode, setViewMode] = React.useState<"grid" | "list">("grid");
  const [moduleFilter, setModuleFilter] = React.useState("All");
  const [typeFilter, setTypeFilter] = React.useState<"all" | "folder" | "file">("all");

  const filtered = React.useMemo(() => {
    let list = MOCK_FILES;
    if (moduleFilter !== "All") list = list.filter(f => f.module === moduleFilter);
    if (typeFilter === "folder") list = list.filter(f => f.type === "folder");
    if (typeFilter === "file") list = list.filter(f => f.type !== "folder");
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(f => f.name.toLowerCase().includes(s));
    }
    return list;
  }, [search, moduleFilter, typeFilter]);

  const folders = filtered.filter(f => f.type === "folder");
  const files = filtered.filter(f => f.type !== "folder");

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">File Manager</h1><p className="text-sm text-muted-foreground mt-0.5">Centralised document storage across all ERP modules</p></div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2 h-9"><Plus className="h-4 w-4" />New Folder</Button>
          <Button className="gap-2 h-9"><Upload className="h-4 w-4" />Upload</Button>
        </div>
      </div>

      {/* Stats + Storage */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Files", value: MOCK_FILES.filter(f => f.type !== "folder").length, icon: File, color: "text-primary", bg: "bg-primary/10" },
          { label: "Folders", value: MOCK_FILES.filter(f => f.type === "folder").length, icon: Folder, color: "text-warning", bg: "bg-warning/10" },
          { label: "Starred", value: MOCK_FILES.filter(f => f.starred).length, icon: Star, color: "text-success", bg: "bg-success/10" },
          { label: "Shared", value: MOCK_FILES.filter(f => f.shared).length, icon: Share2, color: "text-slate-600", bg: "bg-slate-100 dark:bg-slate-800/50" },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", s.bg)}><Icon className={cn("h-5 w-5", s.color)} /></div>
              <div><p className="text-xs text-muted-foreground">{s.label}</p><p className="font-bold text-lg leading-tight">{s.value}</p></div>
            </motion.div>
          );
        })}
      </div>

      {/* Storage Bar */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-sm">
            <HardDrive className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Storage</span>
          </div>
          <span className="text-sm text-muted-foreground">{STORAGE_USED} GB of {STORAGE_TOTAL} GB used</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <motion.div initial={{ width: 0 }} animate={{ width: `${(STORAGE_USED / STORAGE_TOTAL) * 100}%` }} transition={{ duration: 1 }}
            className="h-full rounded-full bg-primary" />
        </div>
        <p className="text-xs text-muted-foreground mt-1">{STORAGE_TOTAL - STORAGE_USED} GB available</p>
      </div>

      {/* Search + Filters + View Toggle */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input placeholder="Search files…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {(["all", "folder", "file"] as const).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize",
                typeFilter === t ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground")}>
              {t === "all" ? "All" : t === "folder" ? "Folders" : "Files"}
            </button>
          ))}
        </div>
        <select value={moduleFilter} onChange={e => setModuleFilter(e.target.value)}
          className="h-9 rounded-lg border border-border bg-background px-3 text-xs text-foreground">
          {MODULE_FILTERS.map(m => <option key={m}>{m}</option>)}
        </select>
        <div className="flex items-center gap-0.5 bg-muted/40 rounded-lg p-0.5 ml-auto">
          <button onClick={() => setViewMode("grid")}
            className={cn("p-1.5 rounded-md transition-all", viewMode === "grid" ? "bg-background shadow-sm" : "text-muted-foreground")}>
            <Grid3X3 className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setViewMode("list")}
            className={cn("p-1.5 rounded-md transition-all", viewMode === "list" ? "bg-background shadow-sm" : "text-muted-foreground")}>
            <List className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Folders */}
      {folders.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Folders</h3>
          <div className={cn("grid gap-3", viewMode === "grid" ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" : "grid-cols-1")}>
            {folders.map((item, i) => {
              const fi = FILE_ICONS[item.type];
              const Icon = fi.icon;
              return (
                <motion.div key={item.id} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }}
                  className={cn("group bg-card border border-border rounded-xl hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer",
                    viewMode === "grid" ? "p-4" : "p-3 flex items-center gap-3")}>
                  <div className={cn("flex items-center justify-center rounded-lg", fi.bg, viewMode === "grid" ? "h-10 w-10 mb-3" : "h-8 w-8 shrink-0")}>
                    <Icon className={cn("h-5 w-5", fi.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.size}</p>
                  </div>
                  {viewMode === "list" && (
                    <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                      <div className="flex items-center gap-1"><Clock className="h-3 w-3" />{item.modified}</div>
                      <span className="px-1.5 py-0.5 bg-muted rounded text-[10px]">{item.module}</span>
                      <button className="opacity-0 group-hover:opacity-100"><MoreHorizontal className="h-4 w-4" /></button>
                    </div>
                  )}
                  {viewMode === "grid" && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">{item.modified}</span>
                      <button className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground">
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Files */}
      {files.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Files</h3>
          {viewMode === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {files.map((item, i) => {
                const fi = FILE_ICONS[item.type];
                const Icon = fi.icon;
                return (
                  <motion.div key={item.id} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }}
                    className="group bg-card border border-border rounded-xl p-4 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer">
                    <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center mb-3", fi.bg)}>
                      <Icon className={cn("h-5 w-5", fi.color)} />
                    </div>
                    <p className="text-sm font-medium truncate mb-0.5">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.size}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-muted-foreground">{item.modified}</span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                        {item.starred && <Star className="h-3 w-3 text-warning fill-warning" />}
                        <button className="text-muted-foreground hover:text-foreground"><Download className="h-3.5 w-3.5" /></button>
                        <button className="text-muted-foreground hover:text-foreground"><MoreHorizontal className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                  <th className="text-left px-4 py-3 font-semibold">Name</th>
                  <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Module</th>
                  <th className="text-right px-4 py-3 font-semibold hidden lg:table-cell">Size</th>
                  <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Modified</th>
                  <th className="text-right px-4 py-3 font-semibold">Actions</th>
                </tr></thead>
                <tbody>
                  {files.map((item, i) => {
                    const fi = FILE_ICONS[item.type];
                    const Icon = fi.icon;
                    return (
                      <motion.tr key={item.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                        className="border-t border-border/40 hover:bg-muted/20 transition-colors cursor-pointer">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className={cn("h-7 w-7 rounded-md flex items-center justify-center shrink-0", fi.bg)}>
                              <Icon className={cn("h-4 w-4", fi.color)} />
                            </div>
                            <div>
                              <p className="font-medium truncate max-w-[200px]">{item.name}</p>
                              {item.starred && <Star className="h-2.5 w-2.5 text-warning fill-warning inline ml-1" />}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="text-xs bg-muted px-2 py-0.5 rounded font-medium">{item.module}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground hidden lg:table-cell">{item.size}</td>
                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                          <div className="flex items-center gap-1"><Clock className="h-3 w-3" />{item.modified}</div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button className="p-1 text-muted-foreground hover:text-foreground transition-colors"><Download className="h-3.5 w-3.5" /></button>
                            <button className="p-1 text-muted-foreground hover:text-foreground transition-colors"><Share2 className="h-3.5 w-3.5" /></button>
                            <button className="p-1 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <File className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No files found.</p>
        </div>
      )}
    </div>
  );
}

