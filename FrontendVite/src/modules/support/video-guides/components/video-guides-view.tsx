import * as React from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, PlayCircle, Search, VideoOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import { useVideoGuides } from "@/hooks/support/use-video-guides";
import { formatDuration, guideModuleKey, type VideoGuide } from "@/lib/support/video-guides.api";
import { VideoPlayerDialog } from "./video-player-dialog";

function GuideCard({ guide, onOpen }: { guide: VideoGuide; onOpen: () => void }) {
  const { t } = useTranslation("support");
  const [posterFailed, setPosterFailed] = React.useState(false);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={t("videos.watchNamed", { title: guide.title })}
      className="group text-start bg-card border border-border rounded-xl overflow-hidden transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative aspect-video bg-muted">
        {guide.posterUrl && !posterFailed ? (
          <img
            src={guide.posterUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
            onError={() => setPosterFailed(true)}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5" />
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/25 transition-colors">
          <PlayCircle className="h-12 w-12 text-white opacity-90 drop-shadow-lg group-hover:scale-110 transition-transform" />
        </div>
        <span className="absolute bottom-2 end-2 rounded-md bg-black/75 px-1.5 py-0.5 text-[11px] font-medium text-white tabular-nums">
          {formatDuration(guide.durationSeconds)}
        </span>
      </div>
      <div className="p-3.5">
        <p className="font-semibold text-sm leading-snug">{guide.title}</p>
        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{guide.description}</p>
      </div>
    </button>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-card border border-border rounded-xl overflow-hidden animate-pulse">
          <div className="aspect-video bg-muted" />
          <div className="p-3.5 space-y-2">
            <div className="h-4 w-2/3 rounded bg-muted" />
            <div className="h-3 w-full rounded bg-muted" />
            <div className="h-3 w-4/5 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function VideoGuidesView() {
  const { t } = useTranslation("support");
  const hasModuleAccess = useAuthStore((s) => s.hasModuleAccess);
  const { data, isLoading, isError, refetch, isFetching } = useVideoGuides();

  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState("all");
  const [moduleFilter, setModuleFilter] = React.useState("all");
  const [showAll, setShowAll] = React.useState(false);
  const [selected, setSelected] = React.useState<VideoGuide | null>(null);

  const guides = data ?? [];

  // A guide is "mine" when it has no module (always available) or the workspace has that module.
  const canSee = React.useCallback((g: VideoGuide) => {
    const key = guideModuleKey(g);
    return !key || hasModuleAccess(key);
  }, [hasModuleAccess]);

  const base = React.useMemo(() => (showAll ? guides : guides.filter(canSee)), [guides, showAll, canSee]);
  const hiddenCount = showAll ? 0 : guides.length - base.length;

  const categories = React.useMemo(() => [...new Set(base.map((g) => g.category).filter(Boolean))], [base]);
  const modules = React.useMemo(
    () => base.filter((g) => g.module).map((g) => ({ value: g.module as string, label: g.title })),
    [base],
  );

  // A filter value that the current list no longer contains behaves as "all" (e.g. after toggling the scope).
  const effCategory = category === "all" || categories.includes(category) ? category : "all";
  const effModule = moduleFilter === "all" || modules.some((m) => m.value === moduleFilter) ? moduleFilter : "all";

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return base.filter((g) => {
      if (effCategory !== "all" && g.category !== effCategory) return false;
      if (effModule !== "all" && g.module !== effModule) return false;
      if (!q) return true;
      return (
        g.title.toLowerCase().includes(q) ||
        g.description.toLowerCase().includes(q) ||
        g.category.toLowerCase().includes(q) ||
        g.chapters.some((c) => c.title.toLowerCase().includes(q))
      );
    });
  }, [base, query, effCategory, effModule]);

  const sections = React.useMemo(() => {
    const map = new Map<string, VideoGuide[]>();
    filtered.forEach((g) => { const k = g.category || ""; map.set(k, [...(map.get(k) ?? []), g]); });
    return [...map.entries()];
  }, [filtered]);

  const clearFilters = () => { setQuery(""); setCategory("all"); setModuleFilter("all"); };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-start gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <PlayCircle className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-bold">{t("videos.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("videos.subtitle")}</p>
        </div>
      </div>

      {isError ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center">
          <AlertTriangle className="h-8 w-8 mx-auto text-amber-500" />
          <p className="mt-3 font-semibold">{t("videos.errorTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("videos.errorBody")}</p>
          <Button className="mt-4" onClick={() => void refetch()} disabled={isFetching}>
            {t("videos.retry")}
          </Button>
        </div>
      ) : isLoading ? (
        <SkeletonGrid />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("videos.search")}
                className="ps-9"
              />
            </div>

            <select
              value={effModule}
              onChange={(e) => setModuleFilter(e.target.value)}
              aria-label={t("videos.module")}
              className="rounded-md border border-input bg-card px-3 py-2 text-sm"
            >
              <option value="all">{t("videos.allModules")}</option>
              {modules.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>

            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
                className="h-4 w-4 rounded border-input accent-primary"
              />
              {t("videos.showAll")}
            </label>
          </div>

          {categories.length > 1 && (
            <div className="flex flex-wrap gap-2 mb-5" role="tablist" aria-label={t("videos.title")}>
              {["all", ...categories].map((c) => (
                <button
                  key={c}
                  type="button"
                  role="tab"
                  aria-selected={effCategory === c}
                  onClick={() => setCategory(c)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                    effCategory === c
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-muted-foreground border-border hover:bg-muted",
                  )}
                >
                  {c === "all" ? t("videos.all") : c}
                </button>
              ))}
            </div>
          )}

          {hiddenCount > 0 && (
            <p className="mb-4 text-xs text-muted-foreground">
              {t("videos.hiddenCount", { count: hiddenCount })}{" "}
              <button type="button" className="text-primary font-medium hover:underline" onClick={() => setShowAll(true)}>
                {t("videos.showAll")}
              </button>
            </p>
          )}

          {filtered.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-10 text-center">
              <VideoOff className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="mt-3 font-semibold">{t("videos.empty")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t("videos.emptyHint")}</p>
              <Button variant="outline" className="mt-4" onClick={clearFilters}>{t("videos.clearFilters")}</Button>
            </div>
          ) : (
            <div className="space-y-8">
              {sections.map(([cat, list]) => (
                <section key={cat || "other"}>
                  {cat && (
                    <h2 className="mb-3 flex items-baseline gap-2 text-sm font-semibold">
                      {cat}
                      <span className="text-xs font-normal text-muted-foreground">
                        {t("videos.guideCount", { count: list.length })}
                      </span>
                    </h2>
                  )}
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {list.map((g) => <GuideCard key={g.slug} guide={g} onOpen={() => setSelected(g)} />)}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}

      <VideoPlayerDialog guide={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
