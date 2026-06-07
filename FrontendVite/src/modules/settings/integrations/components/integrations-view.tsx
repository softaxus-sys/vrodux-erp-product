import * as React from "react";
import { motion } from "framer-motion";
import {
  Link2, Link2Off, AlertCircle, RefreshCw, Plus, Search
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatDate } from "@/lib/utils";

type IntegrationCategory = "auth" | "cloud" | "payments" | "communications" | "marketing" | "analytics" | "automation" | "accounting";
type IntegrationStatus = "connected" | "disconnected" | "error";

interface Integration {
  id: string;
  name: string;
  category: IntegrationCategory;
  status: IntegrationStatus;
  icon: string;
  description: string;
  lastSync?: string;
  accountId?: string;
  webhookUrl?: string;
  color: string;
}

const MOCK_INTEGRATIONS: Integration[] = [
  { id: "i1", name: "Microsoft 365", category: "auth", status: "connected", icon: "M", description: "SSO authentication and email integration for all users.", lastSync: "2026-05-20T08:00:00", accountId: "tenant-softaxis.onmicrosoft.com", color: "bg-blue-500" },
  { id: "i2", name: "AWS", category: "cloud", status: "connected", icon: "A", description: "Cloud hosting, S3 storage, and compute infrastructure.", lastSync: "2026-05-20T07:55:00", accountId: "aws-account-847291035", color: "bg-orange-500" },
  { id: "i3", name: "Stripe", category: "payments", status: "connected", icon: "S", description: "Payment processing for subscriptions and invoices.", lastSync: "2026-05-20T09:30:00", accountId: "acct_1PZzz2CXmqR8Y3Kp", color: "bg-violet-500" },
  { id: "i4", name: "Twilio", category: "communications", status: "connected", icon: "T", description: "SMS notifications and two-factor authentication.", lastSync: "2026-05-20T06:00:00", accountId: "AC8f2b1c3d4e5f6a7b8", color: "bg-red-500" },
  { id: "i5", name: "Mailchimp", category: "marketing", status: "connected", icon: "MC", description: "Email marketing campaigns and subscriber management.", lastSync: "2026-05-19T22:00:00", accountId: "mailchimp-softaxis", color: "bg-amber-500" },
  { id: "i6", name: "Google Analytics", category: "analytics", status: "connected", icon: "G", description: "User behaviour tracking and product analytics.", lastSync: "2026-05-20T09:00:00", accountId: "UA-12345678-9", color: "bg-yellow-500" },
  { id: "i7", name: "Zapier", category: "automation", status: "connected", icon: "Z", description: "Workflow automation connecting 5,000+ apps.", lastSync: "2026-05-20T08:30:00", accountId: "zapier-softaxis-ws", color: "bg-orange-600" },
  { id: "i8", name: "QuickBooks", category: "accounting", status: "error", icon: "QB", description: "Accounting sync for invoices, expenses, and payroll.", lastSync: "2026-05-18T14:20:00", accountId: "qb-realm-87654321", color: "bg-green-600" },
  { id: "i9", name: "Salesforce", category: "auth", status: "disconnected", icon: "SF", description: "Enterprise CRM platform for sales pipeline management.", color: "bg-sky-500" },
  { id: "i10", name: "HubSpot", category: "marketing", status: "disconnected", icon: "H", description: "Inbound marketing, CRM, and customer engagement.", color: "bg-orange-400" },
  { id: "i11", name: "Slack", category: "communications", status: "disconnected", icon: "SL", description: "Team messaging and collaboration notifications.", color: "bg-purple-500" },
  { id: "i12", name: "WhatsApp Business", category: "communications", status: "disconnected", icon: "WA", description: "Customer messaging via WhatsApp Business API.", color: "bg-emerald-500" },
];

const CATEGORY_LABELS: Record<IntegrationCategory, string> = {
  auth: "Authentication",
  cloud: "Cloud",
  payments: "Payments",
  communications: "Communications",
  marketing: "Marketing",
  analytics: "Analytics",
  automation: "Automation",
  accounting: "Accounting",
};

const STATUS_CONFIG: Record<IntegrationStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  connected:    { label: "Connected",    color: "text-success",         bg: "bg-success/10",     icon: Link2 },
  disconnected: { label: "Disconnected", color: "text-muted-foreground", bg: "bg-muted",         icon: Link2Off },
  error:        { label: "Error",        color: "text-destructive",     bg: "bg-destructive/10", icon: AlertCircle },
};

export function IntegrationsView() {
  const [search, setSearch] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState<IntegrationCategory | "all">("all");

  const stats = React.useMemo(() => ({
    total: MOCK_INTEGRATIONS.length,
    connected: MOCK_INTEGRATIONS.filter((i) => i.status === "connected").length,
    disconnected: MOCK_INTEGRATIONS.filter((i) => i.status === "disconnected").length,
    errors: MOCK_INTEGRATIONS.filter((i) => i.status === "error").length,
  }), []);

  const categories = React.useMemo(() => {
    const cats = Array.from(new Set(MOCK_INTEGRATIONS.map((i) => i.category)));
    return cats;
  }, []);

  const filtered = React.useMemo(() => {
    return MOCK_INTEGRATIONS.filter((int) => {
      const matchSearch = !search || int.name.toLowerCase().includes(search.toLowerCase()) || int.description.toLowerCase().includes(search.toLowerCase());
      const matchCat = categoryFilter === "all" || int.category === categoryFilter;
      return matchSearch && matchCat;
    });
  }, [search, categoryFilter]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Integrations</h1>
          <p className="text-muted-foreground mt-1 text-sm">Connect third-party services and manage API integrations.</p>
        </div>
        <Button className="gap-2"><Plus className="h-4 w-4" />Browse Integrations</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Integrations", value: stats.total, color: "bg-primary/10 text-primary" },
          { label: "Connected", value: stats.connected, color: "bg-success/10 text-success" },
          { label: "Disconnected", value: stats.disconnected, color: "bg-muted text-muted-foreground" },
          { label: "Errors", value: stats.errors, color: "bg-destructive/10 text-destructive" },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <p className={cn("text-2xl font-bold", s.color.split(" ")[1])}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search integrations…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setCategoryFilter("all")}
            className={cn("px-3 py-1.5 rounded-full text-xs font-semibold transition-colors", categoryFilter === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={cn("px-3 py-1.5 rounded-full text-xs font-semibold transition-colors", categoryFilter === cat ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      {/* Integration Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((integration, i) => {
          const statusCfg = STATUS_CONFIG[integration.status];
          const StatusIcon = statusCfg.icon;
          return (
            <motion.div
              key={integration.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center text-white font-bold text-sm", integration.color)}>
                    {integration.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold">{integration.name}</h3>
                    <span className="text-xs text-muted-foreground">{CATEGORY_LABELS[integration.category]}</span>
                  </div>
                </div>
                <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold", statusCfg.color, statusCfg.bg)}>
                  <StatusIcon className="h-3 w-3" />
                  {statusCfg.label}
                </span>
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed">{integration.description}</p>

              {integration.status !== "disconnected" && (
                <div className="bg-muted/30 rounded-lg p-3 space-y-1.5">
                  {integration.accountId && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Account ID</span>
                      <span className="font-mono text-xs">{integration.accountId.slice(0, 20)}{integration.accountId.length > 20 ? "…" : ""}</span>
                    </div>
                  )}
                  {integration.lastSync && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Last Sync</span>
                      <span>{formatDate(integration.lastSync, "relative")}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                {integration.status === "disconnected" ? (
                  <Button size="sm" className="flex-1 gap-1.5"><Link2 className="h-3.5 w-3.5" />Connect</Button>
                ) : (
                  <>
                    <Button size="sm" variant="outline" className="flex-1">Configure</Button>
                    {integration.status === "connected" && (
                      <Button size="sm" variant="ghost" className="px-2.5"><RefreshCw className="h-3.5 w-3.5" /></Button>
                    )}
                    {integration.status === "error" && (
                      <Button size="sm" variant="destructive" className="px-2.5"><RefreshCw className="h-3.5 w-3.5" /></Button>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

