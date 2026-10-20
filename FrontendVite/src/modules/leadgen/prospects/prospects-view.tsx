import * as React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AnimatePresence } from "framer-motion";
import { Check, Download, Globe, Loader2, Lock, Phone, Plus, Send, Target, Trash2, UserPlus, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Can, useCan } from "@/components/auth/can";
import { downloadFile, toCsv } from "@/lib/csv";
import { cn, formatNumber } from "@/lib/utils";
import { MANUAL_STATUSES, type ImportToCrmResult, type ProspectDto, type ProspectFilter } from "@/lib/leadgen/leadgen.api";
import { useBulkProspects, useImportToCrm, useMeta, useProspectStats, useProspects, useSearches } from "@/hooks/leadgen/use-leadgen";
import {
  Banner, ConfirmDialog, EmptyState, ErrorBlock, LeadGenFrame, LoadingBlock, NoAccess, Pager, ScoreChip, SearchBox, SELECT, StatusPill, TH, useCanAny, useDebounced,
} from "../shared/ui";
import { ProspectDrawer, EmailStatusPill } from "./prospect-drawer";
import { AddProspectDialog, AddToCampaignDialog, AssignDialog, CrmResultDialog, RevealDialog } from "./prospect-dialogs";

const PAGE_SIZE = 25;

export function ProspectsView() {
  const { t, i18n } = useTranslation("leadgen");
  const ar = i18n.language.startsWith("ar");
  const canView = useCanAny(["leadgen.prospects.view"]);
  const canExport = useCan("leadgen.prospects.export");
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();

  // ── Filters ──
  const [search, setSearch] = React.useState("");
  const [revealed, setRevealed] = React.useState<"" | "yes" | "no">("");
  const [status, setStatus] = React.useState(params.get("status") ?? "");
  const [region, setRegion] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [minQuality, setMinQuality] = React.useState(0);
  const [minFit, setMinFit] = React.useState(0);
  const [hasEmail, setHasEmail] = React.useState<"" | "yes" | "no">("");
  const [sort, setSort] = React.useState("fit");
  const [page, setPage] = React.useState(1);
  const searchId = params.get("search") ?? undefined;
  const debounced = useDebounced(search, 350);

  const filter: ProspectFilter = React.useMemo(() => ({
    search: debounced || undefined, searchId, status: status || undefined,
    revealed: revealed === "" ? undefined : revealed === "yes", region: region || undefined, category: category || undefined,
    minQuality: minQuality || undefined, minFit: minFit || undefined, hasEmail: hasEmail === "" ? undefined : hasEmail === "yes",
    sort, page, pageSize: PAGE_SIZE,
  }), [debounced, searchId, status, revealed, region, category, minQuality, minFit, hasEmail, sort, page]);
  React.useEffect(() => { setPage(1); }, [debounced, searchId, status, revealed, region, category, minQuality, minFit, hasEmail, sort]);

  const meta = useMeta(canView);
  const list = useProspects(filter, canView);
  const stats = useProspectStats(searchId, canView);
  const searches = useSearches(canView);
  const importCrm = useImportToCrm();
  const bulk = useBulkProspects();

  // ── Selection & dialogs ──
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [revealIds, setRevealIds] = React.useState<string[] | null>(null);
  const [campaignIds, setCampaignIds] = React.useState<string[] | null>(null);
  const [assignIds, setAssignIds] = React.useState<string[] | null>(null);
  const [crmResult, setCrmResult] = React.useState<ImportToCrmResult | null>(null);
  const [deleteIds, setDeleteIds] = React.useState<string[] | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [bulkStatus, setBulkStatus] = React.useState("");

  const rows = list.data?.items ?? [];
  const ids = [...selected];
  const selectedRows = rows.filter(r => selected.has(r.id));
  const allOnPage = rows.length > 0 && rows.every(r => selected.has(r.id));
  const toggleAll = () => setSelected(s => { const n = new Set(s); if (allOnPage) rows.forEach(r => n.delete(r.id)); else rows.forEach(r => n.add(r.id)); return n; });
  const toggle = (id: string) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const clear = () => setSelected(new Set());

  const unrevealedIds = ids.filter(id => { const r = rows.find(x => x.id === id); return !r || !r.isRevealed; });
  const revealedIds = ids.filter(id => rows.find(x => x.id === id)?.isRevealed);

  const searchName = searchId ? (searches.data ?? []).find(s => s.id === searchId)?.name : undefined;
  const regions = meta.data?.countries.find(c => c.code === meta.data?.defaultCountry)?.regions ?? [];

  const exportCsv = () => {
    const source = (selectedRows.length > 0 ? selectedRows : rows).filter(r => r.isRevealed);
    if (source.length === 0) return;
    const headers = ["Business", "Category", "Region", "Area", "Address", "Phone", "Email", "Email status", "Website", "Rating", "Reviews", "Fit", "Quality", "Status", "Owner", "Notes"] as ("Business" | "Category" | "Region" | "Area" | "Address" | "Phone" | "Email" | "Email status" | "Website" | "Rating" | "Reviews" | "Fit" | "Quality" | "Status" | "Owner" | "Notes")[];
    const csv = toCsv(source.map(p => ({
      "Business": p.name, "Category": p.categoryLabel ?? "", "Region": p.region ?? "", "Area": p.area ?? "", "Address": p.address ?? "",
      "Phone": p.phone ?? "", "Email": p.email ?? "", "Email status": p.emailStatus, "Website": p.website ?? "",
      "Rating": p.rating ?? "", "Reviews": p.reviewCount ?? "", "Fit": p.fitScore, "Quality": p.qualityScore,
      "Status": p.status, "Owner": p.ownerName ?? "", "Notes": p.notes ?? "",
    })), headers);
    downloadFile(`prospects_${new Date().toISOString().split("T")[0]}.csv`, csv);
  };

  if (!canView) return <LeadGenFrame title={t("prospects.title")}><NoAccess permission="leadgen.prospects.view" /></LeadGenFrame>;

  const s = stats.data;
  const chips: { key: string; label: string; value: number | undefined }[] = [
    { key: "", label: t("prospects.all"), value: s?.total },
    { key: "discovered", label: t("status.discovered"), value: s?.discovered },
    { key: "revealed", label: t("status.revealed"), value: s?.revealed },
    { key: "contacted", label: t("status.contacted"), value: s?.contacted },
    { key: "replied", label: t("status.replied"), value: s?.replied },
    { key: "qualified", label: t("status.qualified"), value: s?.qualified },
  ];

  return (
    <LeadGenFrame title={t("prospects.title")} description={t("prospects.description")}
      actions={<Can permission="leadgen.prospects.create"><Button variant="outline" className="gap-2" onClick={() => setAdding(true)}><Plus className="h-4 w-4" />{t("prospects.addManual")}</Button></Can>}>

      {searchId && (
        <div className="flex items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 font-medium">
            {t("prospects.fromSearch", { name: searchName ?? "…" })}
            <button aria-label={t("action.clear")} onClick={() => { params.delete("search"); setParams(params); }}><X className="h-3.5 w-3.5" /></button>
          </span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {chips.map(c => (
          <button key={c.key} onClick={() => setStatus(c.key)}
            className={cn("px-3 py-1.5 rounded-full border text-xs font-medium transition-colors inline-flex items-center gap-1.5",
              status === c.key ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted/50")}>
            {c.label}{c.value !== undefined && <span className="opacity-70 tabular-nums">{formatNumber(c.value)}</span>}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-3 grid sm:grid-cols-2 lg:grid-cols-6 gap-2">
        <SearchBox className="lg:col-span-2" value={search} onChange={setSearch} placeholder={t("prospects.searchPlaceholder")} />
        <select className={SELECT} value={revealed} onChange={e => setRevealed(e.target.value as "" | "yes" | "no")} aria-label={t("prospects.filterRevealed")}>
          <option value="">{t("prospects.anyReveal")}</option><option value="yes">{t("prospects.revealedOnly")}</option><option value="no">{t("prospects.lockedOnly")}</option>
        </select>
        <select className={SELECT} value={region} onChange={e => setRegion(e.target.value)} aria-label={t("prospects.region")}>
          <option value="">{t("prospects.anyRegion")}</option>{regions.map(r => <option key={r.name} value={r.name}>{ar ? r.nameAr : r.name}</option>)}
        </select>
        <select className={SELECT} value={category} onChange={e => setCategory(e.target.value)} aria-label={t("prospects.category")}>
          <option value="">{t("prospects.anyCategory")}</option>{(meta.data?.categories ?? []).map(c => <option key={c.key} value={c.key}>{ar ? c.labelAr : c.label}</option>)}
        </select>
        <select className={SELECT} value={sort} onChange={e => setSort(e.target.value)} aria-label={t("prospects.sort")}>
          <option value="fit">{t("prospects.sortFit")}</option><option value="quality">{t("prospects.sortQuality")}</option>
          <option value="newest">{t("prospects.sortNewest")}</option><option value="rating">{t("prospects.sortRating")}</option><option value="name">{t("prospects.sortName")}</option>
        </select>
        <select className={SELECT} value={minFit} onChange={e => setMinFit(Number(e.target.value))} aria-label={t("prospects.fit")}>
          <option value={0}>{t("prospects.anyFit")}</option><option value={40}>{t("prospects.fitAtLeast", { n: 40 })}</option><option value={70}>{t("prospects.fitAtLeast", { n: 70 })}</option>
        </select>
        <select className={SELECT} value={minQuality} onChange={e => setMinQuality(Number(e.target.value))} aria-label={t("prospects.quality")}>
          <option value={0}>{t("prospects.anyQuality")}</option><option value={40}>{t("prospects.qualityAtLeast", { n: 40 })}</option><option value={70}>{t("prospects.qualityAtLeast", { n: 70 })}</option>
        </select>
        <select className={SELECT} value={hasEmail} onChange={e => setHasEmail(e.target.value as "" | "yes" | "no")} aria-label={t("prospects.email")}>
          <option value="">{t("prospects.anyEmail")}</option><option value="yes">{t("prospects.withEmail")}</option><option value="no">{t("prospects.withoutEmail")}</option>
        </select>
      </div>

      {/* Bulk actions — each gated by its own permission */}
      {ids.length > 0 && (
        <div className="sticky top-2 z-20 rounded-xl border border-primary/30 bg-card shadow-lg px-4 py-3 flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{t("prospects.selected", { count: ids.length })}</span>
          <button className="text-xs text-muted-foreground hover:underline" onClick={clear}>{t("action.clear")}</button>
          <div className="flex flex-wrap items-center gap-2 ms-auto">
            <Can permission="leadgen.prospects.reveal">
              <Button size="sm" className="gap-1.5" disabled={unrevealedIds.length === 0} onClick={() => setRevealIds(unrevealedIds)}><Lock className="h-3.5 w-3.5" />{t("prospects.revealN", { count: unrevealedIds.length })}</Button>
            </Can>
            <Can permission="leadgen.campaigns.edit">
              <Button size="sm" variant="outline" className="gap-1.5" disabled={revealedIds.length === 0} onClick={() => setCampaignIds(revealedIds)}><Send className="h-3.5 w-3.5" />{t("prospects.addToCampaign")}</Button>
            </Can>
            <Can permission="leadgen.prospects.import">
              <Button size="sm" variant="outline" className="gap-1.5" disabled={revealedIds.length === 0 || importCrm.isPending}
                onClick={() => importCrm.mutate(revealedIds, { onSuccess: r => { setCrmResult(r); clear(); } })}>
                {importCrm.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}{t("prospects.addToCrm")}
              </Button>
            </Can>
            <Can permission="leadgen.prospects.edit">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAssignIds(ids)}><Users className="h-3.5 w-3.5" />{t("prospects.assign")}</Button>
              <select className={cn(SELECT, "h-8 w-auto text-xs")} value={bulkStatus} aria-label={t("prospects.setStatus")}
                onChange={e => { const v = e.target.value; setBulkStatus(""); if (v) bulk.mutate({ ids, action: "status", status: v }, { onSuccess: clear }); }}>
                <option value="">{t("prospects.setStatus")}</option>{MANUAL_STATUSES.map(st => <option key={st} value={st}>{t(`status.${st}`)}</option>)}
              </select>
            </Can>
            {canExport && <Button size="sm" variant="outline" className="gap-1.5" onClick={exportCsv}><Download className="h-3.5 w-3.5" />{t("prospects.export")}</Button>}
            <Can permission="leadgen.prospects.delete"><Button size="sm" variant="ghost" className="gap-1.5 text-destructive" onClick={() => setDeleteIds(ids)}><Trash2 className="h-3.5 w-3.5" />{t("action.delete")}</Button></Can>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {list.isLoading ? <LoadingBlock />
          : list.error ? <ErrorBlock error={list.error as Error} onRetry={() => list.refetch()} />
          : rows.length === 0 ? (
            <EmptyState icon={Target} title={t("prospects.emptyTitle")} body={t("prospects.emptyBody")}
              action={<Can permission="leadgen.searches.create"><Button onClick={() => navigate("/lead-generation/find")}>{t("prospects.findSome")}</Button></Can>} />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground bg-muted/30">
                    <tr>
                      <th className="px-4 py-3 w-10"><Checkbox checked={allOnPage} onCheckedChange={toggleAll} aria-label={t("prospects.selectAll")} /></th>
                      <th className={TH}>{t("prospects.business")}</th><th className={TH}>{t("prospects.contact")}</th>
                      <th className={TH}>{t("prospects.scores")}</th><th className={TH}>{t("prospects.status")}</th><th className={TH}>{t("prospects.owner")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.map(p => <Row key={p.id} p={p} selected={selected.has(p.id)} onToggle={() => toggle(p.id)} onOpen={() => setOpenId(p.id)} />)}
                  </tbody>
                </table>
              </div>
              <Pager page={page} pageSize={PAGE_SIZE} total={list.data?.total ?? 0} onPage={setPage} />
            </>
          )}
      </div>

      {(meta.data && !meta.data.providerConfigured && rows.length === 0) && <Banner tone="warn">{t("banner.providerMissing")}</Banner>}

      <AnimatePresence>
        {openId && <ProspectDrawer id={openId} onClose={() => setOpenId(null)}
          onReveal={i => setRevealIds(i)} onAddToCampaign={i => setCampaignIds(i)}
          onImportToCrm={i => importCrm.mutate(i, { onSuccess: setCrmResult })} onAssign={i => setAssignIds(i)}
          onDelete={p => setDeleteIds([p.id])} />}
        {revealIds && <RevealDialog ids={revealIds} onClose={() => setRevealIds(null)} onDone={clear} />}
        {campaignIds && <AddToCampaignDialog ids={campaignIds} onClose={() => setCampaignIds(null)} onDone={clear} />}
        {assignIds && <AssignDialog ids={assignIds} onClose={() => setAssignIds(null)} onDone={clear} />}
        {crmResult && <CrmResultDialog result={crmResult} onClose={() => setCrmResult(null)} />}
        {adding && <AddProspectDialog onClose={() => setAdding(false)} />}
        {deleteIds && (
          <ConfirmDialog title={t("prospects.deleteTitle", { count: deleteIds.length })} body={t("prospects.deleteBody")} confirmLabel={t("action.delete")} pending={bulk.isPending}
            onClose={() => setDeleteIds(null)}
            onConfirm={() => bulk.mutate({ ids: deleteIds, action: "delete" }, { onSuccess: () => { setDeleteIds(null); setOpenId(null); clear(); } })} />
        )}
      </AnimatePresence>
    </LeadGenFrame>
  );
}

function Row({ p, selected, onToggle, onOpen }: { p: ProspectDto; selected: boolean; onToggle: () => void; onOpen: () => void }) {
  const { t } = useTranslation("leadgen");
  return (
    <tr className={cn("hover:bg-muted/20 cursor-pointer", selected && "bg-primary/5")} onClick={onOpen}>
      <td className="px-4 py-3" onClick={e => e.stopPropagation()}><Checkbox checked={selected} onCheckedChange={onToggle} aria-label={p.name} /></td>
      <td className="px-4 py-3 min-w-[220px]">
        <p className="font-medium truncate max-w-[280px]">{p.name}</p>
        <p className="text-xs text-muted-foreground truncate max-w-[280px]">{[p.categoryLabel, p.area ?? p.city ?? p.region].filter(Boolean).join(" · ")}</p>
      </td>
      <td className="px-4 py-3 min-w-[200px]">
        {p.isRevealed ? (
          <div className="space-y-0.5">
            <p className="text-xs">{p.phone ?? <span className="text-muted-foreground">—</span>}</p>
            <p className="text-xs flex items-center gap-1.5 truncate max-w-[240px]">{p.email ? <><span className="truncate">{p.email}</span><EmailStatusPill status={p.emailStatus} /></> : <span className="text-muted-foreground">{t("prospects.noEmail")}</span>}</p>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" />{t("prospects.lockedShort")}
            {p.hasPhone && <Phone className="h-3 w-3" aria-label={t("prospects.phone")} />}{p.hasWebsite && <Globe className="h-3 w-3" aria-label={t("prospects.website")} />}
          </div>
        )}
      </td>
      <td className="px-4 py-3"><div className="flex flex-col gap-1 items-start"><ScoreChip value={p.fitScore} label={t("prospects.fit")} /><ScoreChip value={p.qualityScore} label={t("prospects.quality")} /></div></td>
      <td className="px-4 py-3"><div className="flex flex-col items-start gap-1"><StatusPill status={p.status} />{p.crmLeadId && <span className="text-[10px] text-success inline-flex items-center gap-0.5"><Check className="h-3 w-3" />{t("prospects.inCrm")}</span>}</div></td>
      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{p.ownerName ?? "—"}</td>
    </tr>
  );
}
