import * as React from "react";
import { cn } from "@/lib/utils";
import { PageHeader } from "../shared/ui";
import { LocationsTab } from "./locations-tab";
import { PositionsTab } from "./positions-tab";
import { FormsTab } from "./forms-tab";
import { MatrixTab } from "./matrix-tab";
import { GeneralTab, RepositoryTab } from "./general-tab";

const TABS = [
  { key: "locations", label: "Locations & units", node: <LocationsTab /> },
  { key: "positions", label: "Positions & people", node: <PositionsTab /> },
  { key: "forms", label: "Forms", node: <FormsTab /> },
  { key: "matrix", label: "Approval matrix", node: <MatrixTab /> },
  { key: "repository", label: "Repository", node: <RepositoryTab /> },
  { key: "general", label: "General", node: <GeneralTab /> },
] as const;

export function SetupView() {
  const [tab, setTab] = React.useState<(typeof TABS)[number]["key"]>("locations");
  return (
    <div>
      <PageHeader title="Setup" subtitle="Locations, who holds each position, the forms, and who approves what." />
      <div className="flex gap-1 overflow-x-auto border-b border-border mb-5">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn("px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors", tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>{t.label}</button>
        ))}
      </div>
      {TABS.find(t => t.key === tab)!.node}
    </div>
  );
}
