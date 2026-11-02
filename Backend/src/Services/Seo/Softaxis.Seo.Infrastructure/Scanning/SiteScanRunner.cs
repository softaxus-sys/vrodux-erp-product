using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Softaxis.Seo.Domain.Entities;
using Softaxis.Seo.Infrastructure.Ai;
using Softaxis.Seo.Infrastructure.Credits;
using Softaxis.Seo.Infrastructure.Crawl;
using Softaxis.Seo.Infrastructure.Persistence;

namespace Softaxis.Seo.Infrastructure.Scanning;

public interface ISiteScanRunner
{
    Task<ScanResult> RunAsync(SeoSite site, CancellationToken ct);
}

/// <param name="NoCredits">The workspace had no credits, so nothing was crawled and nothing was charged.</param>
public sealed record ScanResult(
    Guid AuditId, int IssuesFound, int FixesProposed, int Score = 0, int PagesCrawled = 0,
    int NewIssues = 0, int ResolvedIssues = 0, int CreditsCharged = 0, bool NoCredits = false, long CreditBalance = 0);

/// <summary>
/// One audit: check credits, crawl the site, detect problems, reconcile them against what earlier audits found (so a problem is one
/// record that stays open until it is gone, not a new row every week), score it, ask the AI for fixes for NEW problems only, charge.
/// Shared by "run now" and the scheduled job — an audit must behave identically whether the clock or a click starts it.
/// </summary>
public sealed class SiteScanRunner(
    SeoDbContext db, SiteCrawler crawler, ISeoAiAnalyzer analyzer, ISeoCreditService credits, SeoOptions options, ILogger<SiteScanRunner> logger)
    : ISiteScanRunner
{
    private const int MaxFixesPerScan = 40;
    private const int AuditsWithPages = 5;
    private static readonly HashSet<string> FixableCodes =
    [
        "title.missing", "title.long", "title.short", "desc.missing", "desc.long", "desc.short", "canonical.missing", "schema.missing",
    ];

    public async Task<ScanResult> RunAsync(SeoSite site, CancellationToken ct)
    {
        await credits.EnsureWalletAsync(ct);
        var balance = await credits.BalanceAsync(ct);
        if (balance < 1) return new ScanResult(Guid.Empty, 0, 0, NoCredits: true, CreditBalance: balance);

        var audit = new SeoAudit(site.Id);
        db.Audits.Add(audit);
        await db.SaveChangesAsync(ct);

        try
        {
            // A crawl never goes past what the balance can pay for: the owner is never billed for pages they could not afford.
            var affordable = (int)Math.Min(options.MaxPagesPerAudit, balance * options.PagesPerCredit);
            var crawl = await crawler.CrawlSiteAsync(site.Domain, new CrawlLimits(affordable, options.CrawlConcurrency, options.ExternalLinkCheckLimit), ct);
            var fetched = crawl.Pages.Where(p => !p.BlockedByRobots).ToList();

            if (!fetched.Any(p => p.IsHtml && p.Error is null))
            {
                var home = fetched.FirstOrDefault();
                throw new InvalidOperationException(home?.Error is { Length: > 0 } e
                    ? $"The site could not be reached: {e}"
                    : home?.StatusCode is > 0 ? $"The site answered with HTTP {home.StatusCode} and no web page." : "The site could not be reached.");
            }

            var truncated = crawl.Truncated || fetched.Count >= affordable && affordable < options.MaxPagesPerAudit;
            var findings = SeoIssueDetector.Detect(crawl).ToList();

            // ── Reconcile with earlier audits ────────────────────────────────
            var existing = await db.Issues.Where(i => i.SiteId == site.Id && i.Source == SeoIssueSources.Crawl).ToListAsync(ct);
            var byFingerprint = existing.Where(i => i.Fingerprint.Length > 0).GroupBy(i => i.Fingerprint).ToDictionary(g => g.Key, g => g.OrderByDescending(i => i.LastSeenAt).First());
            var seen = new HashSet<string>(StringComparer.Ordinal);
            var created = new List<(SeoIssue Issue, SeoIssueDetector.Finding Finding)>();
            var countable = new List<SeoIssueDetector.Finding>();
            var newCount = 0;

            foreach (var f in findings)
            {
                seen.Add(f.Fingerprint);
                var details = f.Details.Count == 0 ? null : System.Text.Json.JsonSerializer.Serialize(f.Details.Take(20));
                if (byFingerprint.TryGetValue(f.Fingerprint, out var issue))
                {
                    if (issue.Status == "dismissed") continue;           // the owner said it is fine
                    countable.Add(f);
                    if (issue.Status == "resolved") { issue.Reopen(); newCount++; }
                    if (issue.Status != "applied") issue.Observe(audit.Id, f.Severity, f.Title, f.Description, f.Affected, details);
                    continue;
                }
                countable.Add(f);
                var fresh = new SeoIssue(site.Id, audit.Id, SeoIssueSources.Crawl, f.Category, f.Severity, f.Title, f.Description, f.PageUrl,
                    f.Code, f.Fingerprint, f.Affected, details);
                created.Add((fresh, f));
                newCount++;
            }

            var resolvedCount = 0;
            foreach (var old in existing)
            {
                if (old.Fingerprint.Length == 0)
                {
                    // Issues from before audits had rule ids can never be matched again. One with a fix awaiting review is left for the
                    // owner to decide; any other is superseded by what this audit found.
                    if (old.Status == "open") old.MarkResolved();
                    continue;
                }
                if (!seen.Contains(old.Fingerprint) && old.Status is "open" or "proposed" or "approved")
                { old.MarkResolved(); resolvedCount++; }
            }
            db.Issues.AddRange(created.Select(c => c.Issue));

            // ── AI fixes for the new, fixable problems only ──────────────────
            var pageByUrl = crawl.Pages.GroupBy(p => p.Url).ToDictionary(g => g.Key, g => g.First());
            var eligible = created.Where(c => FixableCodes.Contains(c.Finding.Code) && c.Issue.PageUrl is not null).Take(MaxFixesPerScan).ToList();
            var analysis = await analyzer.ProposeFixesAsync(eligible.Select(c =>
            {
                pageByUrl.TryGetValue(c.Issue.PageUrl!, out var page);
                return new IssueForAnalysis(c.Issue.Id, c.Issue.Category, c.Issue.Title, c.Issue.Description, c.Issue.PageUrl, page?.Title, page?.MetaDescription);
            }).ToList(), ct);

            var fixes = new List<SeoFix>();
            foreach (var p in analysis.Fixes)
            {
                var issue = created.FirstOrDefault(c => c.Issue.Id == p.IssueId).Issue;
                if (issue is null) continue;   // the model named an id we never sent it — ignore, do not trust
                fixes.Add(new SeoFix(issue.Id, site.Id, issue.PageUrl, p.ChangeType, p.ProposedValueJson, p.Rationale));
                issue.MarkProposed();
            }
            db.Fixes.AddRange(fixes);
            if (analysis.SkippedReason is not null)
                logger.LogWarning("SEO audit for site {Site}: {Count} new issue(s) but AI fix analysis did not run: {Reason}", site.Id, created.Count, analysis.SkippedReason);

            // ── Pages table (last few audits only) ───────────────────────────
            var linksIn = crawl.Pages.Where(p => p.IsHtml).SelectMany(p => p.InternalLinks).GroupBy(u => u).ToDictionary(g => g.Key, g => g.Count());
            var issuesByPage = findings.Where(f => f.PageUrl is not null).GroupBy(f => f.PageUrl!).ToDictionary(g => g.Key, g => g.Count());
            var sitemap = crawl.Sitemap.Urls.ToHashSet(StringComparer.Ordinal);
            foreach (var p in fetched.Take(options.MaxPagesPerAudit))
                db.Pages.Add(new SeoPage(audit.Id, site.Id, p.Url)
                {
                    FinalUrl = p.FinalUrl == p.Url ? null : p.FinalUrl, StatusCode = p.StatusCode,
                    RedirectHops = p.RedirectChain.Count(h => h.Status is >= 300 and < 400), ResponseMs = p.ResponseMs, HtmlBytes = p.HtmlBytes,
                    Depth = p.Depth, Title = Clip(p.Title, 500), MetaDescription = Clip(p.MetaDescription, 1000), H1 = Clip(p.H1s.FirstOrDefault(), 500),
                    WordCount = p.WordCount, Indexable = p.IsHtml && p.Ok && !p.Noindex, InSitemap = sitemap.Contains(p.Url),
                    InternalLinksIn = linksIn.GetValueOrDefault(p.Url), InternalLinksOut = p.InternalLinks.Count,
                    IssueCount = issuesByPage.GetValueOrDefault(p.Url), Error = Clip(p.Error, 500),
                });

            // ── Score, charge, complete ──────────────────────────────────────
            var score = SeoScore.Compute(countable, fetched.Count);
            var cost = options.CreditsFor(fetched.Count);
            var spend = await credits.TrySpendAsync(cost, $"SEO audit of {site.Domain} ({fetched.Count} pages)", "seo_audit", audit.Id, $"audit:{audit.Id}", ct);
            if (!spend.Ok) logger.LogWarning("SEO audit {Audit}: credits ran out between the check and the charge; audit kept, nothing charged.", audit.Id);

            var open = countable.Count;
            var note = analysis.SkippedReason;
            audit.Complete(new AuditOutcome(
                OpenIssues: open, FixesProposed: fixes.Count, Score: score, PagesCrawled: fetched.Count,
                Critical: countable.Count(f => f.Severity == SeoIssueSeverities.Critical), High: countable.Count(f => f.Severity == SeoIssueSeverities.High),
                Medium: countable.Count(f => f.Severity == SeoIssueSeverities.Medium), Low: countable.Count(f => f.Severity == SeoIssueSeverities.Low),
                NewIssues: newCount, ResolvedIssues: resolvedCount, CreditsCharged: spend.Ok ? cost : 0, DurationMs: crawl.DurationMs, Truncated: truncated), note);
            site.RecordScanCompleted(DateTime.UtcNow, score, fetched.Count);
            site.ScheduleNextScan(ScanFrequencies.NextRun(site.ScanFrequency, DateTime.UtcNow));
            await db.SaveChangesAsync(ct);

            await PrunePageHistoryAsync(site.Id, ct);

            return new ScanResult(audit.Id, open, fixes.Count, score, fetched.Count, newCount, resolvedCount, spend.Ok ? cost : 0, false, spend.Balance);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "SEO audit failed for site {Site}.", site.Id);
            db.ChangeTracker.Clear();
            var failed = await db.Audits.FirstOrDefaultAsync(a => a.Id == audit.Id, CancellationToken.None);
            if (failed is not null) { failed.Fail(ex.Message); await db.SaveChangesAsync(CancellationToken.None); }
            throw;
        }
    }

    /// <summary>Page rows are kept for the last few audits; older audits keep their score and counts, not their pages.</summary>
    private async Task PrunePageHistoryAsync(Guid siteId, CancellationToken ct)
    {
        try
        {
            var old = await db.Audits.Where(a => a.SiteId == siteId).OrderByDescending(a => a.StartedAt).Skip(AuditsWithPages).Select(a => a.Id).ToListAsync(ct);
            if (old.Count > 0) await db.Pages.Where(p => old.Contains(p.AuditId)).ExecuteDeleteAsync(ct);
        }
        catch (Exception ex) { logger.LogWarning(ex, "Could not prune old SEO page rows for site {Site}.", siteId); }
    }

    private static string? Clip(string? s, int max) => s is null ? null : s.Length <= max ? s : s[..max];
}
