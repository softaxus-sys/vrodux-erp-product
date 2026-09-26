import * as React from "react";
import {
  Check, Loader2, PlayCircle, ChevronDown, ChevronUp, Copy, XCircle,
  Send, Globe, Unplug, Sparkles, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatDate } from "@/lib/utils";
import {
  useContentSettings, useUpdateContentSettings, useArticles, useGenerateArticleNow,
  useApproveArticle, useRejectArticle, usePushArticleToWordPress,
  useWordPressStatus, useConnectWordPress, useDisconnectWordPress, useSetWordPressAutoPublish,
} from "@/hooks/seo/use-seo-content";
import {
  ARTICLE_STATUS_META, parseSourceSignals, type ArticleDto, type ContentFrequency,
} from "@/lib/seo/seo-content.api";

export function ContentTab({ siteId, domain }: { siteId: string; domain: string }) {
  return (
    <div className="space-y-6">
      <ContentSettingsCard siteId={siteId} domain={domain} />
      <WordPressCard siteId={siteId} />
      <ArticleReviewList siteId={siteId} />
    </div>
  );
}

// ── Settings ──────────────────────────────────────────────────────────────

function ContentSettingsCard({ siteId, domain }: { siteId: string; domain: string }) {
  const { data: settings } = useContentSettings(siteId);
  const update = useUpdateContentSettings();
  const generateNow = useGenerateArticleNow();

  const [enabled, setEnabled] = React.useState(false);
  const [frequency, setFrequency] = React.useState<ContentFrequency>("weekly");
  const [articlesPerRun, setArticlesPerRun] = React.useState(1);
  const [targetWordCount, setTargetWordCount] = React.useState(900);
  const [nicheHint, setNicheHint] = React.useState("");
  const [competitors, setCompetitors] = React.useState("");
  const [dirty, setDirty] = React.useState(false);

  React.useEffect(() => {
    if (!settings || dirty) return;
    setEnabled(settings.enabled);
    setFrequency(settings.frequency);
    setArticlesPerRun(settings.articlesPerRun);
    setTargetWordCount(settings.targetWordCount);
    setNicheHint(settings.nicheHint ?? "");
    setCompetitors(settings.competitorDomainsCsv ?? "");
  }, [settings, dirty]);

  const handleSave = () => {
    update.mutate(
      { siteId, body: { enabled, frequency, articlesPerRun, targetWordCount, nicheHint: nicheHint || null, competitorDomainsCsv: competitors || null } },
      { onSuccess: () => setDirty(false) },
    );
  };

  if (!settings) return null;

  return (
    <div className="rounded-xl border border-border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-stone-600" />
          <h3 className="text-sm font-bold text-foreground">Scheduled AI content</h3>
        </div>
        <button type="button" onClick={() => { setEnabled(v => !v); setDirty(true); }}
          className={cn("h-5 w-9 rounded-full relative transition-colors shrink-0",
            enabled ? "bg-primary" : "bg-muted")}>
          <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
            enabled ? "translate-x-4" : "translate-x-0.5")} />
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        The AI drafts full SEO articles on a schedule for review — nothing publishes anywhere without your approval.
      </p>

      {enabled && (
        <div className="space-y-3 pt-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Frequency</label>
              <select value={frequency} onChange={e => { setFrequency(e.target.value as ContentFrequency); setDirty(true); }}
                className="w-full h-8 px-2 rounded-lg border border-border bg-card text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option value="weekly">Weekly</option>
                <option value="biweekly">Every 2 weeks</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Articles per run</label>
              <Input type="number" min={1} max={5} value={articlesPerRun}
                onChange={e => { setArticlesPerRun(Number(e.target.value) || 1); setDirty(true); }} className="h-8 text-xs" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Target word count</label>
            <Input type="number" min={300} max={3000} step={100} value={targetWordCount}
              onChange={e => { setTargetWordCount(Number(e.target.value) || 900); setDirty(true); }} className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">What is {domain} about? (optional, helps topic quality)</label>
            <textarea value={nicheHint} onChange={e => { setNicheHint(e.target.value); setDirty(true); }} rows={2}
              placeholder="e.g. a boutique real-estate agency in Dubai focused on off-plan apartments"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Competitor domains (optional, comma-separated)</label>
            <Input value={competitors} onChange={e => { setCompetitors(e.target.value); setDirty(true); }}
              placeholder="competitor1.com, competitor2.com" className="h-8 text-xs" />
            <p className="text-[10px] text-muted-foreground">
              There's no live "trends" data feed — topics come from real Search Console queries (if Google is
              connected) and pages on the competitors you name here, not invented trend data.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Button size="sm" className="h-8 text-xs gap-1.5" disabled={update.isPending} onClick={handleSave}>
          {update.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Save settings
        </Button>
        {enabled && (
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" disabled={generateNow.isPending || dirty}
            title={dirty ? "Save your changes first" : undefined}
            onClick={() => generateNow.mutate(siteId)}>
            {generateNow.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
            Generate now
          </Button>
        )}
        {settings.nextRunAt && !dirty && (
          <span className="text-[10px] text-muted-foreground ms-auto">Next run {formatDate(settings.nextRunAt)}</span>
        )}
      </div>
    </div>
  );
}

// ── WordPress connection ─────────────────────────────────────────────────

function WordPressCard({ siteId }: { siteId: string }) {
  const { data: status } = useWordPressStatus(siteId);
  const connect = useConnectWordPress();
  const disconnect = useDisconnectWordPress();
  const setAutoPublish = useSetWordPressAutoPublish();

  const [siteUrl, setSiteUrl] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [appPassword, setAppPassword] = React.useState("");
  const [showForm, setShowForm] = React.useState(false);

  if (!status) return null;

  const handleConnect = () => {
    connect.mutate({ siteId, siteUrl, username, appPassword }, {
      onSuccess: () => { setShowForm(false); setSiteUrl(""); setUsername(""); setAppPassword(""); },
    });
  };

  return (
    <div className="rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Globe className="h-4 w-4 text-stone-600" />
        <h3 className="text-sm font-bold text-foreground">WordPress push</h3>
      </div>

      {status.connected ? (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground truncate">{status.siteUrl} — {status.username}</span>
            <span className={cn("px-1.5 py-0.5 rounded font-semibold uppercase text-[10px] shrink-0 ms-2",
              status.status === "connected" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
              {status.status}
            </span>
          </div>
          {status.lastError && <p className="text-xs text-destructive">{status.lastError}</p>}
          <button type="button" onClick={() => setAutoPublish.mutate({ siteId, autoPublish: !status.autoPublish })}
            className="flex items-center gap-2.5 w-full text-left rounded-lg border border-border p-2.5 hover:bg-muted/30 transition-colors">
            <span className={cn("h-4 w-4 rounded flex items-center justify-center border shrink-0",
              status.autoPublish ? "bg-primary border-primary text-primary-foreground" : "border-border")}>
              {status.autoPublish && <Check className="h-3 w-3" />}
            </span>
            <span className="flex-1">
              <span className="text-xs font-medium block">Auto-publish on push</span>
              <span className="text-[10px] text-muted-foreground">
                {status.autoPublish ? "A push goes live immediately in WordPress." : "A push lands as a WordPress draft — you give it a final look there first."}
              </span>
            </span>
          </button>
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-destructive"
            disabled={disconnect.isPending} onClick={() => disconnect.mutate(siteId)}>
            {disconnect.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unplug className="h-3 w-3" />}
            Disconnect
          </Button>
        </div>
      ) : showForm ? (
        <div className="space-y-2.5">
          <Input value={siteUrl} onChange={e => setSiteUrl(e.target.value)} placeholder="https://yoursite.com" className="h-8 text-xs" />
          <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="WordPress username" className="h-8 text-xs" />
          <Input type="password" value={appPassword} onChange={e => setAppPassword(e.target.value)}
            placeholder="Application password" className="h-8 text-xs" />
          <p className="text-[10px] text-muted-foreground">
            Not your login password — create one under WordPress admin → Users → Profile → Application Passwords.
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" className="h-7 text-xs gap-1.5" disabled={connect.isPending || !siteUrl || !username || !appPassword} onClick={handleConnect}>
              {connect.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Connect
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="text-center py-2">
          <p className="text-xs text-muted-foreground mb-2">
            Not connected. Approved articles can still be copied — connecting WordPress adds a one-click push.
          </p>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowForm(true)}>Connect WordPress</Button>
        </div>
      )}
    </div>
  );
}

// ── Article review ────────────────────────────────────────────────────────

function ArticleReviewList({ siteId }: { siteId: string }) {
  const [statusFilter, setStatusFilter] = React.useState<string | undefined>("pending_review");
  const { data: articles = [], isLoading } = useArticles(siteId, statusFilter);
  const approve = useApproveArticle();
  const reject = useRejectArticle();
  const push = usePushArticleToWordPress();
  const { data: wpStatus } = useWordPressStatus(siteId);
  const [expanded, setExpanded] = React.useState<string | null>(null);

  const filters: { key: string | undefined; label: string }[] = [
    { key: "pending_review", label: "Pending review" },
    { key: "approved", label: "Approved" },
    { key: "rejected", label: "Rejected" },
    { key: undefined, label: "All" },
  ];

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-foreground">Articles</h3>
      <div className="flex items-center gap-1.5 flex-wrap">
        {filters.map(f => (
          <button key={f.label} onClick={() => setStatusFilter(f.key)}
            className={cn("px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
              statusFilter === f.key ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted/40")}>
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : articles.length === 0 ? (
        <div className="text-center py-10 text-sm text-muted-foreground">
          No articles here yet. Enable content generation above and run it once to see drafts.
        </div>
      ) : (
        <div className="space-y-3">
          {articles.map(a => (
            <ArticleCard key={a.id} article={a} expanded={expanded === a.id}
              onToggle={() => setExpanded(expanded === a.id ? null : a.id)}
              onApprove={() => approve.mutate(a.id)}
              onReject={() => reject.mutate(a.id)}
              onPush={() => push.mutate(a.id)}
              canPush={!!wpStatus?.connected}
              pending={approve.isPending || reject.isPending || push.isPending} />
          ))}
        </div>
      )}
    </div>
  );
}

function ArticleCard({ article, expanded, onToggle, onApprove, onReject, onPush, canPush, pending }: {
  article: ArticleDto; expanded: boolean; onToggle: () => void;
  onApprove: () => void; onReject: () => void; onPush: () => void; canPush: boolean; pending: boolean;
}) {
  const [copied, setCopied] = React.useState(false);
  const statusMeta = ARTICLE_STATUS_META[article.status];
  const signals = parseSourceSignals(article);

  const copyMarkdown = () => {
    navigator.clipboard.writeText(`# ${article.title}\n\n${article.bodyMarkdown}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-muted/20 transition-colors">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase", statusMeta.bg, statusMeta.color)}>
              {statusMeta.label}
            </span>
            <span className="text-[10px] text-muted-foreground">{article.wordCount} words</span>
            {article.wordPressPostId && <span className="text-[10px] text-muted-foreground">· pushed to WordPress</span>}
          </div>
          <p className="text-sm font-medium text-foreground truncate">{article.title}</p>
          <p className="text-xs text-muted-foreground truncate">Target: {article.targetKeyword || "—"}</p>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          <div className="rounded-lg bg-muted/40 p-3 space-y-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Meta description</p>
            <p className="text-xs text-foreground">{article.metaDescription || "—"}</p>
          </div>

          {signals.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Why this topic</p>
              <ul className="text-xs text-muted-foreground space-y-0.5 list-disc ps-4">
                {signals.slice(0, 6).map((s, i) => <li key={i}>{s.detail}</li>)}
              </ul>
            </div>
          )}

          <div className="max-h-96 overflow-y-auto rounded-lg border border-border p-3 whitespace-pre-wrap text-xs text-foreground leading-relaxed">
            {article.bodyMarkdown}
          </div>

          <div className="flex items-center gap-2 flex-wrap pt-1">
            {article.status === "pending_review" && (
              <>
                <Button size="sm" className="h-8 text-xs gap-1.5" disabled={pending} onClick={onApprove}>
                  <Check className="h-3.5 w-3.5" />Approve
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 text-destructive hover:text-destructive" disabled={pending} onClick={onReject}>
                  <XCircle className="h-3.5 w-3.5" />Reject
                </Button>
              </>
            )}
            {article.status === "approved" && !article.wordPressPostId && canPush && (
              <Button size="sm" className="h-8 text-xs gap-1.5" disabled={pending} onClick={onPush}>
                <Send className="h-3.5 w-3.5" />Push to WordPress
              </Button>
            )}
            {article.wordPressPostId && (
              <span className="text-xs text-success inline-flex items-center gap-1"><ExternalLink className="h-3.5 w-3.5" />WordPress post #{article.wordPressPostId}</span>
            )}
            <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5 ms-auto" onClick={copyMarkdown}>
              {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
              Copy as Markdown
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
