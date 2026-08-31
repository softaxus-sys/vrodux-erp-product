import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UserCheck, Star, DollarSign, TrendingUp, X, Plus, Search, BadgeCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import type { BrokerDto as Broker, BrokerStatus, PropertyType } from "@/lib/real-estate/re.api";
import { useBrokers, useBrokerSummary } from "@/hooks/real-estate/use-re";
import { AddBrokerForm } from "./add-broker-form";

const STATUS_CONFIG: Record<BrokerStatus, { label: string; color: string; bg: string; dot: string }> = {
  active:   { label: "Active",   color: "text-success", bg: "bg-success/10", dot: "bg-success" },
  inactive: { label: "Inactive", color: "text-warning",  bg: "bg-warning/10",  dot: "bg-warning" },
};

const TYPE_LABELS: Record<PropertyType, string> = {
  residential: "Residential", commercial: "Commercial",
  mixed_use: "Mixed Use", industrial: "Industrial", retail: "Retail",
};

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={cn("h-3 w-3", i <= Math.round(rating) ? "text-warning fill-warning" : "text-muted-foreground")} />
      ))}
      <span className="text-xs text-muted-foreground ml-1">{rating.toFixed(1)}</span>
    </div>
  );
}

function BrokerDrawer({ broker, open, onClose }: { broker: Broker | null; open: boolean; onClose: () => void }) {
  const currency = useCurrency();
  if (!broker) return null;
  const sc = STATUS_CONFIG[broker.status];
  return (
    <AnimatePresence>
      {open && (<>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
        <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 280 }}
          className="fixed top-0 right-0 h-full w-full max-w-[520px] bg-background border-l border-border shadow-2xl z-50 flex flex-col">
          <div className="flex items-start justify-between px-6 py-5 border-b border-border">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-bold text-base">{broker.name}</p>
                <BadgeCheck className="h-4 w-4 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">{broker.agencyName}</p>
              <p className="text-xs font-mono text-muted-foreground">{broker.brokerCode} · RERA: {broker.rera}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold", sc.color, sc.bg)}>
                  <span className={cn("h-1.5 w-1.5 rounded-full", sc.dot)} />{sc.label}
                </span>
                <StarRating rating={broker.rating} />
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-success/5 border border-success/20 rounded-xl p-3 text-center">
                <p className="text-[10px] text-muted-foreground">Commission</p>
                <p className="font-bold text-sm text-success">{formatCurrency(broker.totalCommission, currency)}</p>
              </div>
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-center">
                <p className="text-[10px] text-muted-foreground">Closed Deals</p>
                <p className="font-bold text-lg text-primary">{broker.closedDeals}</p>
              </div>
              <div className="bg-muted/30 rounded-xl p-3 text-center">
                <p className="text-[10px] text-muted-foreground">Active Listings</p>
                <p className="font-bold text-lg">{broker.activeListings}</p>
              </div>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Specializations</h4>
              <div className="flex flex-wrap gap-1.5">
                {broker.specializations.map(s => (
                  <span key={s} className="px-2.5 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full">{TYPE_LABELS[s]}</span>
                ))}
              </div>
            </div>
            <div className="bg-muted/30 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span className="text-primary text-xs">{broker.email}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span className="font-mono text-xs">{broker.phone}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Avg Deal Value</span><span className="font-semibold">{formatCurrency(broker.avgDealValue, currency)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Joined</span><span>{formatDate(broker.joinDate, "medium")}</span></div>
            </div>
          </div>
          <div className="border-t border-border px-6 py-4 flex items-center gap-2">
            <Button size="sm" className="gap-1.5 h-9"><Plus className="h-3.5 w-3.5" />Assign Listing</Button>
          </div>
        </motion.div>
      </>)}
    </AnimatePresence>
  );
}

const PAGE_SIZE = 30;

export function BrokersView() {
  const currency = useCurrency();
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<BrokerStatus | "all">("all");
  const [selected, setSelected] = React.useState<Broker | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [showAddForm, setShowAddForm] = React.useState(false);

  const [page, setPage] = React.useState(1);

  // Typing now hits the server, so the request waits until they stop.
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  React.useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(id);
  }, [search]);

  // Both filters now narrow in SQL. Filtering in the browser cannot survive paging: it would
  // filter within one page and under-report.
  React.useEffect(() => { setPage(1); }, [debouncedSearch, statusFilter]);

  const { data: paged, isFetching } = useBrokers({
    search: debouncedSearch || undefined,
    status: statusFilter,
    page,
    pageSize: PAGE_SIZE,
  });
  const brokers    = paged?.items ?? [];
  const totalCount = paged?.totalCount ?? 0;
  const totalPages = paged?.totalPages ?? 1;
  const { data: brokerSummary } = useBrokerSummary();

  const filtered = React.useMemo(() => {
    let list = brokers;
    if (statusFilter !== "all") list = list.filter(b => b.status === statusFilter);
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(b => b.name.toLowerCase().includes(s) || b.agencyName.toLowerCase().includes(s) || b.brokerCode.toLowerCase().includes(s) || b.rera.toLowerCase().includes(s));
    }
    return list;
  }, [search, statusFilter, brokers]);

  const STATS = [
    { label: "Total Brokers", value: brokerSummary?.total ?? brokers.length, icon: UserCheck, color: "text-slate-600", bg: "bg-slate-100 dark:bg-slate-800/50" },
    { label: "Active", value: brokerSummary?.active ?? brokers.filter(b => b.status === "active").length, icon: BadgeCheck, color: "text-success", bg: "bg-success/10" },
    { label: "Total Deals", value: brokerSummary?.totalDeals ?? brokers.reduce((s, b) => s + b.closedDeals, 0), icon: TrendingUp, color: "text-primary", bg: "bg-primary/10" },
    { label: "Total Commission", value: formatCurrency(brokerSummary?.totalCommission ?? brokers.reduce((s, b) => s + b.totalCommission, 0), currency), icon: DollarSign, color: "text-success", bg: "bg-success/10", isText: true },
    { label: "Avg Rating", value: `${(brokerSummary?.avgRating ?? (brokers.length > 0 ? brokers.reduce((s, b) => s + b.rating, 0) / brokers.length : 0)).toFixed(1)}★`, icon: Star, color: "text-warning", bg: "bg-warning/10" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Brokers & Agents</h1><p className="text-sm text-muted-foreground mt-0.5">Manage real estate brokers, listings, and commissions</p></div>
        <Button className="gap-2 h-9" onClick={() => setShowAddForm(true)}><Plus className="h-4 w-4" />Add Broker</Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {STATS.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", s.bg)}><Icon className={cn("h-5 w-5", s.color)} /></div>
              <div className="min-w-0"><p className="text-xs text-muted-foreground truncate">{s.label}</p><p className="font-bold text-sm leading-tight">{s.value}</p></div>
            </motion.div>
          );
        })}
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input placeholder="Search brokers…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
        </div>
        <div className="flex items-center gap-1.5">
          {(["all", "active", "inactive"] as const).map(f => (
            <button key={f} onClick={() => setStatusFilter(f as BrokerStatus | "all")}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize",
                statusFilter === f ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground")}>
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Broker</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Agency</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">RERA</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rating</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Deals</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Commission</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
            </tr>
          </thead>
          <tbody>
            {totalCount === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-sm text-muted-foreground">No brokers found.</td></tr>
            ) : brokers.map((b, i) => {
              const sc = STATUS_CONFIG[b.status] ?? STATUS_CONFIG.inactive;
              return (
                <motion.tr key={b.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                  onClick={() => { setSelected(b); setDrawerOpen(true); }}
                  className="border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors cursor-pointer">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-primary">{b.name.split(" ").map(n => n[0]).join("").slice(0, 2)}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{b.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{b.brokerCode}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-muted-foreground hidden md:table-cell">{b.agencyName}</td>
                  <td className="px-4 py-3.5 text-xs font-mono text-muted-foreground hidden lg:table-cell">{b.rera}</td>
                  <td className="px-4 py-3.5 text-center"><StarRating rating={b.rating} /></td>
                  <td className="px-4 py-3.5 text-center hidden md:table-cell">
                    <p className="font-semibold text-sm">{b.closedDeals}</p>
                    <p className="text-[10px] text-muted-foreground">{b.activeListings} active</p>
                  </td>
                  <td className="px-4 py-3.5 text-right font-semibold text-sm">{formatCurrency(b.totalCommission, currency)}</td>
                  <td className="px-4 py-3.5 text-center">
                    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold", sc.color, sc.bg)}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", sc.dot)} />{sc.label}
                    </span>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </motion.div>
      <BrokerDrawer broker={selected} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <AddBrokerForm open={showAddForm} onClose={() => setShowAddForm(false)} />
    </div>
  );
}

