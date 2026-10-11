import * as React from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkingBranch } from "@/hooks/library/use-library";
import { PageHeader, SELECT, useCanAny } from "../../shared/ui";
import { DeskPanel } from "./desk-panel";
import { LoansPanel } from "./loans-panel";
import { ReservationsPanel, TransfersPanel } from "./reservations-panel";

const TABS = ["desk", "loans", "reservations", "transfers"] as const;
type Tab = typeof TABS[number];

export function CirculationView() {
  const { t } = useTranslation("library");
  const canView = useCanAny(["library.circulation.view"]);
  const { branchId, setBranchId, branches, branch, restricted } = useWorkingBranch();

  // The tab lives in the URL so the dashboard tiles can link straight to "overdue".
  const [params, setParams] = useSearchParams();
  const tab: Tab = (TABS as readonly string[]).includes(params.get("tab") ?? "") ? (params.get("tab") as Tab) : "desk";
  const setTab = (next: Tab) => setParams(next === "desk" ? {} : { tab: next }, { replace: true });

  if (!canView) return <div className="p-12 text-center text-sm text-muted-foreground">{t("noAccess")}</div>;

  return (
    <div className="space-y-6">
      <PageHeader title={t("circulation.title")} description={t("circulation.description")}>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />{restricted ? t("circulation.yourBranch") : t("circulation.thisDesk")}
          <select value={branchId} onChange={e => setBranchId(e.target.value)} className={cn(SELECT, "w-52")}>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
      </PageHeader>

      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {TABS.map(x => (
          <button key={x} onClick={() => setTab(x)}
            className={cn("px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors",
              tab === x ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t(`circulation.tab.${x}`)}
          </button>
        ))}
      </div>

      {tab === "desk" && <DeskPanel branchId={branchId} branchName={branch?.name ?? ""} />}
      {tab === "loans" && (
        <LoansPanel deskBranchId={branchId} branches={branches} initialStatus={params.get("status") ?? "active"} />
      )}
      {tab === "reservations" && <ReservationsPanel branches={branches} deskBranchId={branchId} />}
      {tab === "transfers" && <TransfersPanel />}
    </div>
  );
}
