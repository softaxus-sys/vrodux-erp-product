import * as React from "react";
import { Headset, Inbox, Clock, MessagesSquare, UserX, UserCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatDate } from "@/lib/utils";
import {
  TICKET_STATUS_META, TICKET_PRIORITY_META, TICKET_CATEGORIES,
  type TicketStatus, type TicketCategory,
} from "@/lib/support/support.api";
import { useSupportQueue, useSupportQueueSummary } from "@/hooks/support/use-support";
import { useSupportQueueRealtime } from "@/hooks/support/use-support-realtime";
import { TicketDrawer } from "@/modules/support/components/ticket-drawer";

const STATUS_FILTERS: { value: TicketStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "waiting_on_customer", label: "Waiting on Customer" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

function StatTile({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="h-4.5 w-4.5 text-primary" />
        </div>
        <div>
          <p className="text-lg font-bold leading-none">{value}</p>
          <p className="text-xs text-muted-foreground mt-1">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SupportQueueView() {
  const [statusFilter, setStatusFilter] = React.useState<TicketStatus | "all">("all");
  const [categoryFilter, setCategoryFilter] = React.useState<TicketCategory | "all">("all");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  useSupportQueueRealtime(true);
  const { data: summary } = useSupportQueueSummary();
  const { data: tickets = [], isLoading, isError } = useSupportQueue({
    status: statusFilter === "all" ? undefined : statusFilter,
    category: categoryFilter === "all" ? undefined : categoryFilter,
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Headset className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-bold">Support Queue</h1>
          <p className="text-sm text-muted-foreground">Every VroduxERP tenant's support tickets, in one place.</p>
        </div>
      </div>

      {isError ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            You don't have access to the support queue.
          </CardContent>
        </Card>
      ) : (
        <>
          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
              <StatTile icon={Inbox} label="Total" value={summary.total} />
              <StatTile icon={MessagesSquare} label="Open" value={summary.open} />
              <StatTile icon={Clock} label="In Progress" value={summary.inProgress} />
              <StatTile icon={Clock} label="Waiting on Customer" value={summary.waitingOnCustomer} />
              <StatTile icon={UserX} label="Unassigned" value={summary.unassigned} />
              <StatTile icon={UserCheck} label="My Open" value={summary.myOpen} />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map(f => (
                <button key={f.value} onClick={() => setStatusFilter(f.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
                    statusFilter === f.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-muted-foreground border-border hover:bg-muted")}>
                  {f.label}
                </button>
              ))}
            </div>
            <select
              className="ml-auto text-xs rounded-md border border-input bg-card px-2 py-1.5"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as TicketCategory | "all")}
            >
              <option value="all">All categories</option>
              {TICKET_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground py-12 text-center">Loading queue…</p>
          ) : tickets.length === 0 ? (
            <Card><CardContent className="py-14 text-center text-sm text-muted-foreground">Nothing here.</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {tickets.map(tk => (
                <Card key={tk.id} className="cursor-pointer hover:border-primary/40 transition-colors" onClick={() => setSelectedId(tk.id)}>
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm truncate">{tk.subject}</p>
                        <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold", TICKET_STATUS_META[tk.status].color, TICKET_STATUS_META[tk.status].bg)}>
                          {TICKET_STATUS_META[tk.status].label}
                        </span>
                        <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize", TICKET_PRIORITY_META[tk.priority].color, TICKET_PRIORITY_META[tk.priority].bg)}>
                          {tk.priority}
                        </span>
                        {!tk.assignedToUserId && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-muted text-muted-foreground">unassigned</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {tk.requestingTenantName} &middot; {tk.requestingUserName} &middot; {tk.ticketNumber}
                        {tk.assignedToUserName && <> &middot; assigned to {tk.assignedToUserName}</>}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground shrink-0">{formatDate(tk.updatedAt ?? tk.createdAt)}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      <TicketDrawer ticketId={selectedId} open={!!selectedId} onClose={() => setSelectedId(null)} agentMode />
    </div>
  );
}
