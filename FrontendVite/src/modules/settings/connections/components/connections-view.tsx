import * as React from "react";
import { Link } from "react-router-dom";
import { Bot, KeyRound, Mail, Plug, ShoppingBag, CreditCard, Search, ExternalLink, ShieldCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import { useAiSettings } from "@/hooks/ai/use-ai";
import { useProviderCatalog } from "@/hooks/crm/use-integrations";
import { useMailboxes } from "@/hooks/leadgen/use-leadgen";
import { useChannels } from "@/hooks/ecommerce/use-ecommerce";

type Tone = "ok" | "warn" | "off" | "info";

interface RowProps {
  icon: React.ElementType;
  title: string;
  description: string;
  href: string;
  tone: Tone;
  status: string;
  loading?: boolean;
}

const TONE: Record<Tone, string> = {
  ok: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  warn: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  off: "bg-muted text-muted-foreground",
  info: "bg-primary/10 text-primary",
};

function Row({ icon: Icon, title, description, href, tone, status, loading }: RowProps) {
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3.5">
      <span className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0"><Icon className="h-4 w-4 text-muted-foreground" /></span>
      <div className="min-w-0 flex-1 basis-56">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", TONE[tone])}>
        {loading && <Loader2 className="h-3 w-3 animate-spin" />}{status}
      </span>
      <Button asChild variant="outline" size="sm" className="gap-1.5"><Link to={href}>Manage<ExternalLink className="h-3 w-3" /></Link></Button>
    </li>
  );
}

function plural(n: number, one: string, many = `${one}s`) { return `${n} ${n === 1 ? one : many}`; }

// Each row owns its query, so a row that is not shown never calls its API (and a workspace without the module never sees a 403).

function AiRow() {
  const q = useAiSettings(true);
  const d = q.data;
  return <Row icon={Bot} title="AI Assistant" href="/ai-assistant" loading={q.isLoading}
    description="The AI model the assistant, SEO fixes and article drafts run on. You bring your own key; it is stored encrypted and never shown again."
    tone={q.isError ? "off" : d?.hasApiKey ? "ok" : "warn"}
    status={q.isLoading ? "Checking" : q.isError ? "Open to check" : d?.hasApiKey ? `Your ${d.provider} key is connected` : "No key set up yet"} />;
}

function IntegrationsRow() {
  const q = useProviderCatalog(true);
  const items = (q.data ?? []).filter(i => i.connected);
  const bad = items.filter(i => i.status === "error").length;
  return <Row icon={Plug} title="Lead sources & portals" href="/settings/integrations" loading={q.isLoading}
    description="Meta lead ads, Bayut, Property Finder, Google Forms, Calendly and website forms that bring leads into the CRM."
    tone={q.isError ? "off" : bad > 0 ? "warn" : items.length > 0 ? "ok" : "off"}
    status={q.isLoading ? "Checking" : q.isError ? "Open to check" : items.length === 0 ? "None connected" : bad > 0 ? `${plural(items.length, "source")} connected, ${bad} need${bad === 1 ? "s" : ""} attention` : `${plural(items.length, "source")} connected`} />;
}

function MailboxesRow() {
  const q = useMailboxes(true);
  const list = q.data ?? [];
  const bad = list.filter(m => m.status === "error").length;
  const ok = list.filter(m => m.status === "connected").length;
  return <Row icon={Mail} title="Outreach mailboxes" href="/lead-generation/mailboxes" loading={q.isLoading}
    description="The Google, Microsoft or SMTP mailboxes Lead Generation sends from and reads replies in. Passwords and tokens are stored encrypted."
    tone={q.isError ? "off" : bad > 0 ? "warn" : ok > 0 ? "ok" : "off"}
    status={q.isLoading ? "Checking" : q.isError ? "Open to check" : list.length === 0 ? "None connected" : bad > 0 ? `${plural(list.length, "mailbox", "mailboxes")}, ${bad} need${bad === 1 ? "s" : ""} attention` : `${plural(ok, "mailbox", "mailboxes")} connected`} />;
}

function ChannelsRow() {
  const q = useChannels();
  const list = q.data ?? [];
  const bad = list.filter(c => c.status === "error").length;
  return <Row icon={ShoppingBag} title="Sales channels" href="/ecommerce/channels" loading={q.isLoading}
    description="Shopify stores your products are published to. The access token is stored encrypted."
    tone={q.isError ? "off" : bad > 0 ? "warn" : list.length > 0 ? "ok" : "off"}
    status={q.isLoading ? "Checking" : q.isError ? "Open to check" : list.length === 0 ? "None connected" : bad > 0 ? `${plural(list.length, "store")}, ${bad} need${bad === 1 ? "s" : ""} attention` : `${plural(list.length, "store")} connected`} />;
}

/**
 * One place that shows every outside service the workspace has connected, whether it is working, and where to change it.
 * Keys, tokens and passwords are NOT collected or shown here: each stays in the screen of the module that uses it, encrypted at rest,
 * and is never displayed again after it is saved. This page is the map, so nobody has to remember which module holds which key.
 */
export function ConnectionsView() {
  const { hasRawPermission, hasModuleAccess } = useAuthStore();
  const can = (perm: string) => perm.split("|").some(p => hasRawPermission(p));

  const staticRows: (RowProps & { show: boolean })[] = [
    {
      show: hasModuleAccess("ecommerce") && can("ecommerce.store.view"), icon: CreditCard, title: "Online store payments", href: "/ecommerce/store",
      description: "Your own Stripe and PayPal keys for the online store, plus bank-transfer and cash-on-delivery details.", tone: "info", status: "Set up in Store settings",
    },
    {
      show: hasModuleAccess("pos") && can("pos.sessions.approve"), icon: CreditCard, title: "Card terminal / payment gateway", href: "/settings/payment-gateway",
      description: "The gateway the point of sale takes card payments through.", tone: "info", status: "Set up in Payment Gateway",
    },
    {
      show: hasModuleAccess("seo") && can("seo.sites.view"), icon: Search, title: "Google & WordPress for SEO", href: "/seo/sites",
      description: "Google Search Console and Analytics, and the WordPress site articles are published to. Each is connected per website.", tone: "info", status: "Connected per website",
    },
    {
      show: can("settings.users.view"), icon: ShieldCheck, title: "Sign-in security", href: "/settings/security",
      description: "Two-factor authentication for your own account.", tone: "info", status: "Your account",
    },
  ];
  const visibleStatic = staticRows.filter(r => r.show);

  const live: React.ReactNode[] = [];
  if (hasModuleAccess("ai-assistant")) live.push(<AiRow key="ai" />);
  if (hasModuleAccess("crm") && can("settings.integrations.view")) live.push(<IntegrationsRow key="int" />);
  if (hasModuleAccess("leadgen") && can("leadgen.mailboxes.view")) live.push(<MailboxesRow key="mail" />);
  if (hasModuleAccess("ecommerce") && can("ecommerce.channels.view")) live.push(<ChannelsRow key="ch" />);

  const none = live.length === 0 && visibleStatic.length === 0;

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" />API keys & connections</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every outside service this workspace uses, in one list: whether it is connected and working, and where to change it.
          Keys and passwords stay in the screen of the module that uses them, are stored encrypted, and are never shown again after saving.
        </p>
      </div>

      {none ? (
        <p className="text-sm text-muted-foreground rounded-xl border border-border p-6 text-center">
          Nothing to show. Your plan or role does not include any module that connects to an outside service.
        </p>
      ) : (
        <>
          {live.length > 0 && (
            <section className="rounded-xl border border-border bg-card overflow-hidden">
              <h2 className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b border-border">Status</h2>
              <ul className="divide-y divide-border">{live}</ul>
            </section>
          )}
          {visibleStatic.length > 0 && (
            <section className="rounded-xl border border-border bg-card overflow-hidden">
              <h2 className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b border-border">More connections</h2>
              <ul className="divide-y divide-border">{visibleStatic.map(({ show: _s, ...r }) => <Row key={r.title} {...r} />)}</ul>
            </section>
          )}
        </>
      )}

      <p className="text-xs text-muted-foreground">
        Credits for paid add-ons such as SEO audits and Lead Generation are bought in Settings → Billing, not here. Platform-wide keys (payments, keyword data)
        are set by the platform owner and are not part of your workspace.
      </p>
    </div>
  );
}
