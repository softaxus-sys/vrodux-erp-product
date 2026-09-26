import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, ChevronLeft, ChevronRight, Loader2, Check, Copy, Globe,
  Rocket, ExternalLink, RefreshCw, PlayCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  useSeoSite, useCreateSeoSite, useUpdateSeoSite,
  useStartGoogleOAuth, useGoogleProperties, useSelectGoogleProperties,
  useRunScanNow, useVerifySiteNow,
} from "@/hooks/seo/use-seo";
import type { ScanFrequency } from "@/lib/seo/seo.api";

interface Props {
  open: boolean;
  onClose: () => void;
  /** When set, resumes an existing site (e.g. after the Google OAuth redirect back). */
  siteId?: string | null;
  /** Which step to land on when resuming an existing site. */
  initialStep?: number;
}

const STEPS = ["Site details", "Install snippet", "Connect Google", "Finish"];

const PLATFORM_TABS = ["WordPress", "Static HTML", "Next.js / custom", "Webflow / Wix / Squarespace"] as const;
type Platform = typeof PLATFORM_TABS[number];

export function ConnectSiteWizard({ open, onClose, siteId: resumeSiteId, initialStep }: Props) {
  const [step, setStep] = React.useState(initialStep ?? 1);
  const [activeSiteId, setActiveSiteId] = React.useState<string | null>(resumeSiteId ?? null);
  const [platform, setPlatform] = React.useState<Platform>("WordPress");

  const [domain, setDomain] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [frequency, setFrequency] = React.useState<ScanFrequency>("weekly");

  const [gscPropertyId, setGscPropertyId] = React.useState("");
  const [ga4PropertyId, setGa4PropertyId] = React.useState("");

  const { data: site } = useSeoSite(activeSiteId);
  const verifyNow = useVerifySiteNow();
  const [lastCheckedAt, setLastCheckedAt] = React.useState<Date | null>(null);
  const create = useCreateSeoSite();
  const update = useUpdateSeoSite();
  const startOAuth = useStartGoogleOAuth();
  const { data: properties } = useGoogleProperties(activeSiteId, step === 3 && !!site?.googleConnected);
  const selectProperties = useSelectGoogleProperties();
  const runScan = useRunScanNow();
  const [scanTriggered, setScanTriggered] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    if (resumeSiteId) { setActiveSiteId(resumeSiteId); setStep(initialStep ?? 3); }
    else { setActiveSiteId(null); setStep(1); setDomain(""); setDisplayName(""); setFrequency("weekly"); setScanTriggered(false); }
  }, [open, resumeSiteId, initialStep]);

  // Actively re-checks (server fetches the page itself — see useVerifySiteNow) every 5s while step 2
  // is open and unverified. Deliberately not a passive refetch of cached status: this is what makes
  // "leave the tab open" actually converge instead of only reporting whatever the last check found.
  React.useEffect(() => {
    if (step !== 2 || !activeSiteId || site?.verificationStatus === "verified") return;
    const id = setInterval(() => verifyNow.mutate(activeSiteId, { onSuccess: () => setLastCheckedAt(new Date()) }), 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, activeSiteId, site?.verificationStatus]);

  const domainValid = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(domain.trim());

  const handleCreateSite = () => {
    if (!domainValid) return;
    const cleanDomain = domain.trim().replace(/^https?:\/\//i, "").replace(/\/$/, "");
    create.mutate(
      { domain: cleanDomain, displayName: displayName.trim() || cleanDomain, scanFrequency: frequency },
      { onSuccess: (created) => { setActiveSiteId(created.id); setStep(2); } },
    );
  };

  const snippetOrigin = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}`;
  const snippetTag = site
    ? `<script src="${snippetOrigin}/api/seo/snippet/${site.snippetKey}/tag.js" async></script>`
    : "";

  const handleConnectGoogle = async () => {
    if (!activeSiteId) return;
    const { url } = await startOAuth.mutateAsync(activeSiteId);
    window.location.href = url;
  };

  const handleSaveProperties = () => {
    if (!activeSiteId) return;
    const gsc = properties?.gscProperties.find(p => p.externalId === gscPropertyId);
    const ga4 = properties?.ga4Properties.find(p => p.externalId === ga4PropertyId);
    selectProperties.mutate(
      { siteId: activeSiteId, body: {
        gscPropertyId: gsc?.externalId ?? null, gscPropertyName: gsc?.name ?? null,
        ga4PropertyId: ga4?.externalId ?? null, ga4PropertyName: ga4?.name ?? null,
      } },
      { onSuccess: () => setStep(4) },
    );
  };

  const handleRunFirstScan = () => {
    if (!activeSiteId) return;
    setScanTriggered(true);
    runScan.mutate(activeSiteId, { onSuccess: onClose });
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className="fixed right-0 top-0 h-full w-full max-w-xl bg-card border-l border-border z-50 flex flex-col shadow-2xl"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-stone-100 dark:bg-stone-900/40 flex items-center justify-center">
                  <Rocket className="h-4 w-4 text-stone-700 dark:text-stone-300" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">Connect a site</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Step {step} of 4 — {STEPS[step - 1]}</p>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground"><X className="w-4 h-4" /></button>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-1.5 px-6 py-3 border-b border-border shrink-0">
              {STEPS.map((label, i) => (
                <div key={label} className="flex-1 flex items-center gap-1.5">
                  <div className={cn("h-1.5 flex-1 rounded-full transition-colors",
                    i + 1 <= step ? "bg-primary" : "bg-muted")} />
                </div>
              ))}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {step === 1 && (
                <>
                  <p className="text-sm text-muted-foreground">
                    Tell us which website the AI agent should audit and improve. You can connect more sites later.
                  </p>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Website domain</label>
                    <Input value={domain} onChange={e => setDomain(e.target.value)} placeholder="vrodux.com" className="h-9 text-sm" />
                    {domain.trim() && !domainValid && (
                      <p className="text-xs text-destructive">Enter a plain domain, e.g. vrodux.com (no https:// needed).</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Display name (optional)</label>
                    <Input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder={domain || "e.g. VroduxERP Marketing Site"} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Scan frequency</label>
                    <select value={frequency} onChange={e => setFrequency(e.target.value as ScanFrequency)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      <option value="weekly">Weekly — recommended while the AI is still learning the site</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                </>
              )}

              {step === 2 && site && (
                <>
                  <p className="text-sm text-muted-foreground">
                    Add this one-line tag to your site's <code className="text-xs bg-muted px-1 py-0.5 rounded">&lt;head&gt;</code> section.
                    It reports back when your site loads and applies any SEO fixes you've approved — nothing changes on your site until you approve a fix.
                  </p>
                  <SnippetBlock code={snippetTag} />

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {PLATFORM_TABS.map(p => (
                      <button key={p} onClick={() => setPlatform(p)}
                        className={cn("px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                          platform === p ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted/40")}>
                        {p}
                      </button>
                    ))}
                  </div>
                  <PlatformInstructions platform={platform} />

                  <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
                    <strong className="text-foreground">If your site sets a Content-Security-Policy header</strong> (common on
                    Next.js/enterprise sites, rare on WordPress/static/Wix/Squarespace), add{" "}
                    <code className="text-[11px] bg-muted px-1 py-0.5 rounded">{snippetOrigin}</code>{" "}
                    to both <code className="text-[11px] bg-muted px-1 py-0.5 rounded">script-src</code> and{" "}
                    <code className="text-[11px] bg-muted px-1 py-0.5 rounded">connect-src</code>. This is only needed so
                    approved fixes can actually apply on your live site — it does not block verification below, which we
                    check server-side.
                  </p>

                  <VerificationStatus verified={site.verificationStatus === "verified"} checking={verifyNow.isPending}
                    lastCheckedAt={lastCheckedAt}
                    onRefresh={() => verifyNow.mutate(site.id, { onSuccess: () => setLastCheckedAt(new Date()) })} />
                </>
              )}

              {step === 3 && site && (
                <>
                  <p className="text-sm text-muted-foreground">
                    Connecting Google Search Console and Analytics lets the agent confirm which pages Google
                    actually indexes and how they perform — optional, but recommended.
                  </p>

                  {!site.googleConnected ? (
                    <div className="rounded-xl border border-border p-5 flex flex-col items-center gap-3 text-center">
                      <Globe className="h-8 w-8 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium text-foreground">Not connected</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          You'll be sent to Google to sign in and grant read-only access. One click covers both
                          Search Console and Analytics.
                        </p>
                      </div>
                      <Button onClick={handleConnectGoogle} disabled={startOAuth.isPending} className="gap-1.5">
                        {startOAuth.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
                        Connect Google
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm text-success">
                        <Check className="h-4 w-4" /> Google account connected
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Search Console property</label>
                        <select value={gscPropertyId} onChange={e => setGscPropertyId(e.target.value)}
                          className="w-full h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                          <option value="">{properties ? "Select a property…" : "Loading…"}</option>
                          {properties?.gscProperties.map(p => <option key={p.externalId} value={p.externalId}>{p.name}</option>)}
                        </select>
                        {properties && properties.gscProperties.length === 0 && (
                          <p className="text-xs text-muted-foreground">No Search Console properties found on this Google account.</p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Analytics (GA4) property</label>
                        <select value={ga4PropertyId} onChange={e => setGa4PropertyId(e.target.value)}
                          className="w-full h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                          <option value="">{properties ? "Select a property…" : "Loading…"}</option>
                          {properties?.ga4Properties.map(p => <option key={p.externalId} value={p.externalId}>{p.name}</option>)}
                        </select>
                        {properties && properties.ga4Properties.length === 0 && (
                          <p className="text-xs text-muted-foreground">No Analytics properties found on this Google account.</p>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}

              {step === 4 && site && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-border p-4 space-y-3">
                    <SummaryRow label="Domain" value={site.domain} />
                    <SummaryRow label="Scan frequency" value={site.scanFrequency === "weekly" ? "Weekly" : "Monthly"} />
                    <SummaryRow
                      label="Snippet"
                      value={site.verificationStatus === "verified" ? "Verified — receiving traffic" : "Installed, waiting for first visit"}
                      good={site.verificationStatus === "verified"}
                    />
                    <SummaryRow label="Google" value={site.googleConnected ? "Connected" : "Not connected"} good={site.googleConnected} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Every proposed fix is queued for your review — nothing goes live on your site until you approve it.
                    Run the first scan now, or the agent will run automatically on the schedule you chose.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex items-center justify-between shrink-0">
              {step === 1 ? (
                <Button variant="outline" onClick={onClose}>Cancel</Button>
              ) : (
                <Button variant="outline" onClick={() => setStep(s => Math.max(1, s - 1))} className="gap-1">
                  <ChevronLeft className="h-4 w-4" />Back
                </Button>
              )}

              {step === 1 && (
                <Button onClick={handleCreateSite} disabled={!domainValid || create.isPending} className="gap-1.5">
                  {create.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Next<ChevronRight className="h-4 w-4" />
                </Button>
              )}
              {step === 2 && (
                <Button onClick={() => setStep(3)} className="gap-1">Next<ChevronRight className="h-4 w-4" /></Button>
              )}
              {step === 3 && (
                site?.googleConnected ? (
                  <Button onClick={handleSaveProperties} disabled={selectProperties.isPending} className="gap-1.5">
                    {selectProperties.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Continue<ChevronRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button variant="ghost" onClick={() => setStep(4)}>Skip for now</Button>
                )
              )}
              {step === 4 && (
                <Button onClick={handleRunFirstScan} disabled={runScan.isPending || scanTriggered} className="gap-1.5">
                  {runScan.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
                  Run first scan now
                </Button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function SnippetBlock({ code }: { code: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <div className="relative group">
      <pre className="bg-muted rounded-lg p-3 pr-11 text-xs overflow-x-auto font-mono leading-relaxed" dir="ltr">
        <code>{code}</code>
      </pre>
      <button
        onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        className="absolute top-2 right-2 p-1.5 rounded-md bg-background/80 border border-border hover:bg-background"
        title="Copy"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

function PlatformInstructions({ platform }: { platform: Platform }) {
  const text: Record<Platform, string> = {
    "WordPress": "Install a header/footer plugin (e.g. \"Insert Headers and Footers\") or edit your theme's header.php, and paste the tag right before the closing </head> tag.",
    "Static HTML": "Paste the tag into the <head> of every page template, or once in a shared header include if your site uses one.",
    "Next.js / custom": "Add the tag inside your root layout's <Head> (Pages Router) or the <head> export in app/layout.tsx (App Router), so it loads on every page.",
    "Webflow / Wix / Squarespace": "Open your site settings → Custom Code / Header Code, and paste the tag into the \"Head Code\" section, then publish your site.",
  };
  return <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">{text[platform]}</p>;
}

function VerificationStatus({ verified, checking, lastCheckedAt, onRefresh }: {
  verified: boolean; checking: boolean; lastCheckedAt: Date | null; onRefresh: () => void;
}) {
  if (verified) {
    return (
      <div className="flex items-center gap-2 text-sm text-success rounded-lg border border-success/30 bg-success/5 px-3 py-2.5">
        <Check className="h-4 w-4" /> Verified — the snippet is live on your site.
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-border bg-muted/20 px-3 py-2.5 space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <span className="flex items-center gap-2">
          {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {checking ? "Checking…" : "Not verified yet"}
        </span>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" disabled={checking} onClick={onRefresh}>
          {checking ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          Check now
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {lastCheckedAt && !checking && `Still not verified — last checked ${lastCheckedAt.toLocaleTimeString()}. `}
        We check by fetching your page ourselves and looking for the tag — this works even if your site
        has a strict Content-Security-Policy, an ad-blocker is active, or the page just hasn't loaded in a
        browser yet. If it stays unverified after a minute, double-check the tag is actually saved and
        published on the live page (not a draft, and not cached by a CDN). You can close this wizard and
        come back any time from the site's detail panel, which has the same "Recheck" button.
      </p>
    </div>
  );
}

function SummaryRow({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-medium", good === true && "text-success", good === false && "text-muted-foreground")}>{value}</span>
    </div>
  );
}
