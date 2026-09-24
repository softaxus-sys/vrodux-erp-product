using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Softaxis.Seo.Domain.Entities;
using Softaxis.Seo.Infrastructure.Ai;
using Softaxis.Seo.Infrastructure.Crawl;
using Softaxis.Seo.Infrastructure.Persistence;

namespace Softaxis.Seo.Infrastructure.Scanning;

public interface ISiteScanRunner
{
    Task<ScanResult> RunAsync(SeoSite site, CancellationToken ct);
}

public sealed record ScanResult(Guid AuditId, int IssuesFound, int FixesProposed);

/// <summary>
/// One scan: crawl the site, detect deterministic technical/on-page issues, ask the AI to propose a
/// fix per issue, store everything. Shared by both "run now" (RunScanNowHandler) and the scheduled
/// background job (SeoScanBackgroundService) — a scan must behave identically whether it fires by
/// the clock or by a manual click.
/// </summary>
public sealed class SiteScanRunner(SeoDbContext db, SiteCrawler crawler, ISeoAiAnalyzer analyzer, ILogger<SiteScanRunner> logger)
    : ISiteScanRunner
{
    public async Task<ScanResult> RunAsync(SeoSite site, CancellationToken ct)
    {
        var audit = new SeoAudit(site.Id);
        db.Audits.Add(audit);
        await db.SaveChangesAsync(ct);

        try
        {
            var pages = await crawler.CrawlAsync(site.Domain, ct);
            var pageByUrl = pages.ToDictionary(p => p.Url);

            var issues = new List<SeoIssue>();
            foreach (var page in pages)
            foreach (var finding in SeoIssueDetector.Detect(page))
                issues.Add(new SeoIssue(site.Id, audit.Id, SeoIssueSources.Crawl, finding.Category,
                    finding.Severity, finding.Title, finding.Description, finding.PageUrl));

            db.Issues.AddRange(issues);
            await db.SaveChangesAsync(ct);

            var analysisInput = issues.Select(i =>
            {
                pageByUrl.TryGetValue(i.PageUrl ?? "", out var page);
                return new IssueForAnalysis(i.Id, i.Category, i.Title, i.Description, i.PageUrl, page?.Title, page?.MetaDescription);
            }).ToList();

            var proposals = await analyzer.ProposeFixesAsync(analysisInput, ct);
            var fixes = new List<SeoFix>();
            foreach (var p in proposals)
            {
                var issue = issues.FirstOrDefault(i => i.Id == p.IssueId);
                if (issue is null) continue; // AI referenced an id we never sent it — ignore, don't trust
                fixes.Add(new SeoFix(issue.Id, site.Id, issue.PageUrl, p.ChangeType, p.ProposedValueJson, p.Rationale));
                issue.MarkProposed();
            }
            db.Fixes.AddRange(fixes);

            site.RecordScanCompleted(DateTime.UtcNow);
            site.ScheduleNextScan(ScanFrequencies.NextRun(site.ScanFrequency, DateTime.UtcNow));
            audit.Complete(issues.Count, fixes.Count);
            await db.SaveChangesAsync(ct);

            return new ScanResult(audit.Id, issues.Count, fixes.Count);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "SEO scan failed for site {Site}.", site.Id);
            audit.Fail(ex.Message);
            await db.SaveChangesAsync(ct);
            throw;
        }
    }
}
