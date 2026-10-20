import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AnimatePresence } from "framer-motion";
import { Loader2, MapPin, Radar, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Can } from "@/components/auth/can";
import { cn, formatDate } from "@/lib/utils";
import { isSearchActive, type CategoryDto, type SearchDto, type SearchInput } from "@/lib/leadgen/leadgen.api";
import {
  useCancelSearch, useCreateSearch, useDeleteSearch, useEstimateSearch, useMeta, useProfile, useSearches,
} from "@/hooks/leadgen/use-leadgen";
import {
  Banner, ConfirmDialog, EmptyState, ErrorBlock, Field, LeadGenFrame, LoadingBlock, NoAccess, SearchBox, StatusPill, useCanAny, useDebounced,
} from "../shared/ui";

/** Chip that toggles on and off. Selection is shown by fill AND a check, never by colour alone. */
function Chip({ active, onClick, children, disabled, title }: { active: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean; title?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title} aria-pressed={active}
      className={cn("px-2.5 py-1 rounded-full border text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
        active ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted/50")}>
      {active && <span aria-hidden className="me-1">✓</span>}{children}
    </button>
  );
}

export function FindView() {
  const { t, i18n } = useTranslation("leadgen");
  const navigate = useNavigate();
  const ar = i18n.language.startsWith("ar");
  const canView = useCanAny(["leadgen.searches.view"]);

  const meta = useMeta(canView);
  const profile = useProfile(canView);
  const searches = useSearches(canView);
  const estimate = useEstimateSearch();
  const create = useCreateSearch();
  const cancel = useCancelSearch();
  const del = useDeleteSearch();

  const [country, setCountry] = React.useState("AE");
  const [regions, setRegions] = React.useState<string[]>([]);
  const [areas, setAreas] = React.useState<string[]>([]);
  const [categories, setCategories] = React.useState<string[]>([]);
  const [keywords, setKeywords] = React.useState("");
  const [name, setName] = React.useState("");
  const [maxResults, setMaxResults] = React.useState(100);
  const [catFilter, setCatFilter] = React.useState("");
  const [toDelete, setToDelete] = React.useState<SearchDto | null>(null);

  const countryInfo = meta.data?.countries.find(c => c.code === country);
  const maxAllowed = Math.min(1000, meta.data?.limits.maxResultsPerSearch ?? 300);

  // Start from the workspace's own preferences once they load.
  const seeded = React.useRef(false);
  React.useEffect(() => {
    if (seeded.current || !meta.data || !profile.data) return;
    seeded.current = true;
    setCountry(profile.data.countryCode || meta.data.defaultCountry || "AE");
    setRegions(profile.data.preferredRegions.slice(0, 7));
    setCategories(profile.data.preferredCategories.slice(0, 8));
  }, [meta.data, profile.data]);

  React.useEffect(() => { if (maxResults > maxAllowed) setMaxResults(maxAllowed); }, [maxAllowed, maxResults]);

  // Areas only make sense inside the regions chosen; drop any that no longer apply.
  const availableAreas = React.useMemo(
    () => (countryInfo?.regions ?? []).filter(r => regions.includes(r.name)).flatMap(r => r.areas.map(a => ({ area: a, region: r.name }))),
    [countryInfo, regions]);
  React.useEffect(() => { setAreas(a => a.filter(x => availableAreas.some(v => v.area === x))); }, [availableAreas]);

  const input: SearchInput = React.useMemo(() => ({
    name: name.trim() || autoName(categories, regions, meta.data?.categories ?? [], ar),
    countryCode: country, regions, areas, categories, keywords: keywords.trim() || null, maxResults,
  }), [name, categories, regions, areas, country, keywords, maxResults, meta.data?.categories, ar]);

  const valid = regions.length > 0 && categories.length > 0;
  const debounced = useDebounced(input, 500);

  // A live estimate, so the person sees how big the search is before starting it.
  React.useEffect(() => {
    if (debounced.regions.length > 0 && debounced.categories.length > 0) estimate.mutate(debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(debounced)]);

  const toggle = (list: string[], set: (v: string[]) => void, v: string, max: number) =>
    set(list.includes(v) ? list.filter(x => x !== v) : list.length >= max ? list : [...list, v]);

  const groups = React.useMemo(() => {
    const q = catFilter.trim().toLowerCase();
    const map = new Map<string, CategoryDto[]>();
    for (const c of meta.data?.categories ?? []) {
      const label = ar ? c.labelAr : c.label;
      if (q && !label.toLowerCase().includes(q) && !c.label.toLowerCase().includes(q)) continue;
      map.set(c.group, [...(map.get(c.group) ?? []), c]);
    }
    return [...map.entries()];
  }, [meta.data?.categories, catFilter, ar]);

  if (!canView) return <LeadGenFrame title={t("find.title")}><NoAccess permission="leadgen.searches.view" /></LeadGenFrame>;
  if (meta.isLoading) return <LeadGenFrame title={t("find.title")}><LoadingBlock /></LeadGenFrame>;
  if (meta.error) return <LeadGenFrame title={t("find.title")}><ErrorBlock error={meta.error as Error} onRetry={() => meta.refetch()} /></LeadGenFrame>;

  const m = meta.data!;
  const est = estimate.data;
  const needsProfile = profile.data && !profile.data.offerSummary && profile.data.preferredCategories.length === 0;
  const blocked = !m.enabled || !m.providerConfigured;

  const start = () =>
    create.mutate(input, {
      onSuccess: () => { setName(""); },
    });

  return (
    <LeadGenFrame title={t("find.title")} description={t("find.description")}>
      {!m.enabled && <Banner tone="bad">{t("banner.disabled")}</Banner>}
      {m.enabled && !m.providerConfigured && <Banner tone="warn">{t("banner.providerMissing")}</Banner>}
      {needsProfile && (
        <Banner tone="info" action={<Can permission="leadgen.settings.edit"><Button size="sm" variant="outline" onClick={() => navigate("/lead-generation/settings")}>{t("find.setProfile")}</Button></Can>}>
          {t("find.profileHint")}
        </Banner>
      )}

      <div className="grid xl:grid-cols-5 gap-5">
        {/* ── The search form ── */}
        <section className="xl:col-span-3 rounded-xl border border-border bg-card p-5 space-y-5">
          <Field label={t("find.country")}>
            <div className="flex flex-wrap gap-1.5">
              {m.countries.map(c => (
                <Chip key={c.code} active={country === c.code} disabled={!c.allowed}
                  title={c.allowed ? undefined : t("find.comingSoon")} onClick={() => { setCountry(c.code); setRegions([]); setAreas([]); }}>
                  {ar ? c.nameAr : c.name}{!c.allowed && <span className="ms-1 opacity-70">· {t("find.soon")}</span>}
                </Chip>
              ))}
            </div>
            {countryInfo?.complianceNote && <p className="text-[11px] text-muted-foreground mt-1.5">{countryInfo.complianceNote}</p>}
          </Field>

          <Field label={t("find.regions")} hint={t("find.regionsHint")}>
            <div className="flex flex-wrap gap-1.5">
              {(countryInfo?.regions ?? []).map(r => (
                <Chip key={r.name} active={regions.includes(r.name)} onClick={() => toggle(regions, setRegions, r.name, 7)}>{ar ? r.nameAr : r.name}</Chip>
              ))}
            </div>
          </Field>

          {availableAreas.length > 0 && (
            <Field label={t("find.areas")} hint={t("find.areasHint")}>
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-0.5">
                {availableAreas.map(a => (
                  <Chip key={`${a.region}-${a.area}`} active={areas.includes(a.area)} onClick={() => toggle(areas, setAreas, a.area, 20)}>
                    <MapPin className="inline h-3 w-3 me-1 -mt-0.5" />{a.area}
                  </Chip>
                ))}
              </div>
              {areas.length > 0 && <button type="button" className="text-[11px] text-primary mt-1.5" onClick={() => setAreas([])}>{t("find.clearAreas")}</button>}
            </Field>
          )}

          <Field label={t("find.categories")} hint={t("find.categoriesHint", { count: categories.length })}>
            <SearchBox value={catFilter} onChange={setCatFilter} placeholder={t("find.filterCategories")} className="mb-3 max-w-xs" />
            <div className="space-y-3 max-h-72 overflow-y-auto pe-1">
              {groups.map(([group, items]) => (
                <div key={group}>
                  <p className="text-[11px] font-semibold text-muted-foreground mb-1.5">{group}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {items.map(c => (
                      <Chip key={c.key} active={categories.includes(c.key)} disabled={!categories.includes(c.key) && categories.length >= 8}
                        onClick={() => toggle(categories, setCategories, c.key, 8)}>{ar ? c.labelAr : c.label}</Chip>
                    ))}
                  </div>
                </div>
              ))}
              {groups.length === 0 && <p className="text-xs text-muted-foreground">{t("find.noCategoryMatch")}</p>}
            </div>
          </Field>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label={t("find.keywords")} hint={t("find.keywordsHint")}>
              <Input value={keywords} maxLength={120} onChange={e => setKeywords(e.target.value)} placeholder={t("find.keywordsPlaceholder")} />
            </Field>
            <Field label={t("find.maxResults")} hint={t("find.maxHint", { max: maxAllowed })}>
              <Input type="number" min={10} max={maxAllowed} value={maxResults}
                onChange={e => setMaxResults(Math.max(10, Math.min(maxAllowed, parseInt(e.target.value || "10", 10) || 10)))} />
            </Field>
          </div>

          <Field label={t("find.name")} hint={t("find.nameHint")}>
            <Input value={name} maxLength={120} onChange={e => setName(e.target.value)} placeholder={input.name} />
          </Field>

          {/* Estimate */}
          <div className="rounded-lg bg-muted/40 border border-border p-3 text-sm space-y-1.5">
            {!valid ? <p className="text-muted-foreground">{t("find.estimateEmpty")}</p>
              : estimate.isPending && !est ? <p className="text-muted-foreground flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" />{t("find.estimating")}</p>
              : est && (
                <>
                  <p>{t("find.estimate", { lookups: est.plannedQueries, max: est.maxResults })}</p>
                  <p className="text-xs text-muted-foreground">{t("find.estimateFree", { left: est.searchesLeftToday, cost: m.limits.revealCost })}</p>
                  {est.warnings.map((w, i) => <p key={i} className="text-xs text-amber-700 dark:text-amber-400">{w}</p>)}
                </>
              )}
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">{t("find.dailyUsage", { used: m.limits.searchesToday, limit: m.limits.dailySearchLimit })}</p>
            <Can permission="leadgen.searches.create" fallback={<p className="text-xs text-muted-foreground">{t("find.noCreate")}</p>}>
              <Button className="gap-2" disabled={!valid || blocked || create.isPending || (est ? est.searchesLeftToday <= 0 : false)} onClick={start}>
                {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radar className="h-4 w-4" />}{t("find.start")}
              </Button>
            </Can>
          </div>
        </section>

        {/* ── Recent searches ── */}
        <section className="xl:col-span-2 space-y-3">
          <h2 className="text-sm font-bold">{t("find.recent")}</h2>
          {searches.isLoading ? <LoadingBlock />
            : searches.error ? <ErrorBlock error={searches.error as Error} onRetry={() => searches.refetch()} />
            : (searches.data ?? []).length === 0
              ? <div className="rounded-xl border border-border bg-card"><EmptyState icon={Search} title={t("find.noSearches")} body={t("find.noSearchesBody")} /></div>
              : (searches.data ?? []).map(s => (
                <article key={s.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{s.name}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{formatDate(s.createdAt, "relative")}{s.createdByName ? ` · ${s.createdByName}` : ""}</p>
                    </div>
                    <StatusPill status={s.status} />
                  </div>

                  {isSearchActive(s) && (
                    <div className="mt-3">
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full w-1/3 rounded-full bg-primary animate-pulse" /></div>
                      <p className="text-xs text-muted-foreground mt-1.5 truncate">{s.progress ?? t("find.queued")}</p>
                    </div>
                  )}
                  {s.status === "failed" && s.error && <p className="text-xs text-destructive mt-2">{s.error}</p>}
                  {!isSearchActive(s) && s.status !== "failed" && (
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div><p className="text-lg font-bold tabular-nums">{s.foundCount}</p><p className="text-[10px] text-muted-foreground">{t("find.found")}</p></div>
                      <div><p className="text-lg font-bold tabular-nums">{s.newCount}</p><p className="text-[10px] text-muted-foreground">{t("find.new")}</p></div>
                      <div><p className="text-lg font-bold tabular-nums">{s.revealedCount}</p><p className="text-[10px] text-muted-foreground">{t("find.revealed")}</p></div>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-1.5 mt-3">
                    {isSearchActive(s) && <Can permission="leadgen.searches.create"><Button size="sm" variant="outline" disabled={cancel.isPending} onClick={() => cancel.mutate(s.id)}><X className="h-3.5 w-3.5 me-1" />{t("action.cancel")}</Button></Can>}
                    {!isSearchActive(s) && s.foundCount > 0 && <Can permission="leadgen.prospects.view"><Button size="sm" onClick={() => navigate(`/lead-generation/prospects?search=${s.id}`)}>{t("find.viewResults")}</Button></Can>}
                    {s.status !== "running" && <Can permission="leadgen.searches.delete"><Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setToDelete(s)} aria-label={t("action.delete")}><Trash2 className="h-3.5 w-3.5" /></Button></Can>}
                  </div>
                </article>
              ))}
        </section>
      </div>

      <AnimatePresence>
        {toDelete && (
          <ConfirmDialog title={t("find.deleteTitle", { name: toDelete.name })} body={t("find.deleteBody")} confirmLabel={t("action.delete")} pending={del.isPending}
            onClose={() => setToDelete(null)} onConfirm={() => del.mutate({ id: toDelete.id }, { onSuccess: () => setToDelete(null) })} />
        )}
      </AnimatePresence>
    </LeadGenFrame>
  );
}

/** "Dental clinics · Dubai" — a readable default so nobody has to name a search to run one. */
function autoName(categories: string[], regions: string[], all: CategoryDto[], ar: boolean) {
  const cat = categories.map(k => all.find(c => c.key === k)).filter(Boolean).map(c => (ar ? c!.labelAr : c!.label));
  const what = cat.length === 0 ? "" : cat.length <= 2 ? cat.join(" + ") : `${cat[0]} +${cat.length - 1}`;
  const where = regions.length <= 2 ? regions.join(" + ") : `${regions[0]} +${regions.length - 1}`;
  return [what, where].filter(Boolean).join(" · ") || "Search";
}
