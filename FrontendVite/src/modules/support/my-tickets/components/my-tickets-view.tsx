import * as React from "react";
import { LifeBuoy, Plus, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatDate } from "@/lib/utils";
import {
  TICKET_STATUS_META, TICKET_PRIORITY_META, TICKET_CATEGORIES,
  type TicketStatus,
} from "@/lib/support/support.api";
import { useMyTickets } from "@/hooks/support/use-support";
import { NewTicketForm } from "./new-ticket-form";
import { TicketDrawer } from "@/modules/support/components/ticket-drawer";

const STATUS_FILTERS: { value: TicketStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "waiting_on_customer", label: "Waiting on You" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

export default function MyTicketsView() {
  const [statusFilter, setStatusFilter] = React.useState<TicketStatus | "all">("all");
  const [showNewTicket, setShowNewTicket] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const { data: tickets = [], isLoading } = useMyTickets(statusFilter === "all" ? undefined : statusFilter);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <LifeBuoy className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Help &amp; Support</h1>
            <p className="text-sm text-muted-foreground">Raise a ticket with the VroduxERP team, or track one you've already sent.</p>
          </div>
        </div>
        <Button onClick={() => setShowNewTicket(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> New ticket
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
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

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-12 text-center">Loading your tickets…</p>
      ) : tickets.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium">No tickets yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Need help with something? Raise a ticket and our team will get back to you by email.
            </p>
            <Button size="sm" className="mt-4" onClick={() => setShowNewTicket(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> New ticket
            </Button>
          </CardContent>
        </Card>
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
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {tk.ticketNumber} &middot; {TICKET_CATEGORIES.find(c => c.value === tk.category)?.label ?? tk.category}
                    {" "}&middot; {tk.messageCount} {tk.messageCount === 1 ? "message" : "messages"}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground shrink-0">{formatDate(tk.updatedAt ?? tk.createdAt)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <NewTicketForm open={showNewTicket} onClose={() => setShowNewTicket(false)} />
      <TicketDrawer ticketId={selectedId} open={!!selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
