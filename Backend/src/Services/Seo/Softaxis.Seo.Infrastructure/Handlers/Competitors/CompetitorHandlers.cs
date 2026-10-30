using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Seo.Application.Competitors;
using Softaxis.Seo.Domain.Entities;
using Softaxis.Seo.Infrastructure.Competitors;
using Softaxis.Seo.Infrastructure.Content;
using Softaxis.Seo.Infrastructure.Credits;
using Softaxis.Seo.Infrastructure.Crawl;
using Softaxis.Seo.Infrastructure.Net;
using Softaxis.Seo.Infrastructure.Persistence;

namespace Softaxis.Seo.Infrastructure.Handlers.Competitors;

internal static class CompetitorMappings
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static ScanSummaryDto ToSummary(SeoCompetitorScan s)
    {
        static int Count(string json) { try { using var d = JsonDocument.Parse(json); return d.RootElement.GetArrayLength(); } catch { return 0; } }
        return new ScanSummaryDto(s.Id, s.Status, s.CreatedAt, s.CompletedAt, s.PagesCrawled, s.CreditsCharged, s.KeywordDataUsed,
            s.KeywordDataNote, s.Error, Count(s.TopicGapsJson), Count(s.KeywordGapsJson), s.LocationCode);
    }

    public static PlanItemDto ToDto(SeoPlanItem i) =>
        new(i.Id, i.PlannedDate, i.Title, i.TargetKeyword, i.Reason, i.SearchVolume, i.Difficulty, i.Source, i.Status, i.ArticleId);

    /// <summary>The most one comparison can cost right now.</summary>
    public static int Estimate(SeoOptions o, bool keywordData, int competitors) =>
        o.CreditsFor((competitors + 1) * o.CompetitorPagesPerDomain) + (keywordData ? competitors * o.CreditsPerCompetitorKeywords : 0);
}

internal sealed class GetCompetitorsHandler(SeoDbContext db, IKeywordDataProvider keywords, ISeoCreditService credits, SeoOptions options)
    : IQueryHandler<GetCompetitorsQuery, CompetitorsOverviewDto>
{
    public async Task<Result<CompetitorsOverviewDto>> Handle(GetCompetitorsQuery q, CancellationToken ct)
    {
        if (!await db.Sites.AnyAsync(s => s.Id == q.SiteId, ct)) return Result.Failure<CompetitorsOverviewDto>(Error.NotFoundById("SeoSite", q.SiteId));

        var list = await db.Competitors.AsNoTracking().Where(c => c.SiteId == q.SiteId).OrderBy(c => c.CreatedAt)
            .Select(c => new CompetitorDto(c.Id, c.Domain, c.CreatedAt)).ToListAsync(ct);
        var latest = await db.CompetitorScans.AsNoTracking().Where(s => s.SiteId == q.SiteId).OrderByDescending(s => s.CreatedAt).FirstOrDefaultAsync(ct);
        var balance = await credits.BalanceAsync(ct);

        return Result.Success(new CompetitorsOverviewDto(
            q.SiteId, list, SeoCompetitor.Max, keywords.IsConfigured, CompetitorMappings.Estimate(options, keywords.IsConfigured, list.Count),
            options.CompetitorPagesPerDomain, options.CreditsPerCompetitorKeywords, balance,
            latest is null ? null : CompetitorMappings.ToSummary(latest), CompetitorLocations.All));
    }
}

internal sealed class AddCompetitorHandler(SeoDbContext db, IConfiguration configuration) : ICommandHandler<AddCompetitorCommand, CompetitorDto>
{
    public async Task<Result<CompetitorDto>> Handle(AddCompetitorCommand cmd, CancellationToken ct)
    {
        var site = await db.Sites.FirstOrDefaultAsync(s => s.Id == cmd.SiteId, ct);
        if (site is null) return Result.Failure<CompetitorDto>(Error.NotFoundById("SeoSite", cmd.SiteId));

        var domain = SeoCompetitor.Normalize(cmd.Domain);
        var allowPrivate = SeoNetwork.AllowPrivate(configuration);
        if (domain.Length == 0 || domain.Contains(':') && !allowPrivate || !SsrfGuard.IsPlausiblePublicHost(domain.Split(':')[0], allowPrivate) || !domain.Contains('.'))
            return Result.Failure<CompetitorDto>(Error.Custom("Validation.Failed", "That does not look like a public website address. Enter a domain such as example.com."));

        var own = SeoCompetitor.Normalize(site.Domain);
        if (domain == own) return Result.Failure<CompetitorDto>(Error.Custom("Validation.Failed", "That is your own website. Enter a competitor's address."));

        var existing = await db.Competitors.Where(c => c.SiteId == cmd.SiteId).Select(c => c.Domain).ToListAsync(ct);
        if (existing.Contains(domain)) return Result.Failure<CompetitorDto>(Error.Custom("Competitor.Duplicate", "That competitor is already on the list."));
        if (existing.Count >= SeoCompetitor.Max)
            return Result.Failure<CompetitorDto>(Error.Custom("Validation.Failed", $"You can compare against up to {SeoCompetitor.Max} competitors. Remove one first."));

        var c = new SeoCompetitor(cmd.SiteId, domain);
        db.Competitors.Add(c);
        await db.SaveChangesAsync(ct);
        return Result.Success(new CompetitorDto(c.Id, c.Domain, c.CreatedAt));
    }
}

internal sealed class RemoveCompetitorHandler(SeoDbContext db) : ICommandHandler<RemoveCompetitorCommand>
{
    public async Task<Result> Handle(RemoveCompetitorCommand cmd, CancellationToken ct)
    {
        var c = await db.Competitors.FirstOrDefaultAsync(x => x.Id == cmd.Id, ct);
        if (c is null) return Result.Failure(Error.NotFoundById("SeoCompetitor", cmd.Id));
        db.Competitors.Remove(c);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class StartCompetitorScanHandler(
    SeoDbContext db, IKeywordDataProvider keywords, ISeoCreditService credits, SeoOptions options, ICompetitorScanQueue queue)
    : ICommandHandler<StartCompetitorScanCommand, ScanSummaryDto>
{
    public async Task<Result<ScanSummaryDto>> Handle(StartCompetitorScanCommand cmd, CancellationToken ct)
    {
        if (TenantAmbient.TenantId is not { } tenantId)
            return Result.Failure<ScanSummaryDto>(Error.Custom("Validation.Failed", "Could not work out which workspace this is."));
        if (!await db.Sites.AnyAsync(s => s.Id == cmd.SiteId, ct)) return Result.Failure<ScanSummaryDto>(Error.NotFoundById("SeoSite", cmd.SiteId));

        var location = cmd.LocationCode ?? CompetitorLocations.Default;
        if (!CompetitorLocations.IsKnown(location)) return Result.Failure<ScanSummaryDto>(Error.Custom("Validation.Failed", "Choose one of the listed countries."));

        var domains = await db.Competitors.AsNoTracking().Where(c => c.SiteId == cmd.SiteId).OrderBy(c => c.CreatedAt).Select(c => c.Domain).ToListAsync(ct);
        if (domains.Count == 0) return Result.Failure<ScanSummaryDto>(Error.Custom("Validation.Failed", "Add at least one competitor first."));

        var busy = await db.CompetitorScans.AnyAsync(s => s.SiteId == cmd.SiteId && (s.Status == CompetitorScanStatuses.Queued || s.Status == CompetitorScanStatuses.Running), ct);
        if (busy) return Result.Failure<ScanSummaryDto>(Error.Custom("Competitor.Conflict", "A comparison is already running for this website. It will finish in a few minutes."));

        // The comparison can only cost up to this much; refuse up front rather than do the work and fail to charge.
        var need = CompetitorMappings.Estimate(options, keywords.IsConfigured, domains.Count);
        var balance = await credits.BalanceAsync(ct);
        if (balance < need)
            return Result.Failure<ScanSummaryDto>(Error.Custom("Credits.Insufficient",
                $"This comparison can use up to {need} credits and you have {balance}. Buy more credits in Settings → Billing, then try again."));

        var scan = new SeoCompetitorScan(cmd.SiteId, location, JsonSerializer.Serialize(domains, CompetitorMappings.Json));
        db.CompetitorScans.Add(scan);
        await db.SaveChangesAsync(ct);
        queue.Enqueue(tenantId, scan.Id);
        return Result.Success(CompetitorMappings.ToSummary(scan));
    }
}

internal sealed class GetCompetitorScansHandler(SeoDbContext db) : IQueryHandler<GetCompetitorScansQuery, IReadOnlyList<ScanSummaryDto>>
{
    public async Task<Result<IReadOnlyList<ScanSummaryDto>>> Handle(GetCompetitorScansQuery q, CancellationToken ct)
    {
        var rows = await db.CompetitorScans.AsNoTracking().Where(s => s.SiteId == q.SiteId).OrderByDescending(s => s.CreatedAt).Take(20).ToListAsync(ct);
        return Result.Success<IReadOnlyList<ScanSummaryDto>>(rows.Select(CompetitorMappings.ToSummary).ToList());
    }
}

internal sealed class GetCompetitorScanHandler(SeoDbContext db) : IQueryHandler<GetCompetitorScanQuery, ScanDetailDto>
{
    public async Task<Result<ScanDetailDto>> Handle(GetCompetitorScanQuery q, CancellationToken ct)
    {
        var scan = await db.CompetitorScans.AsNoTracking().FirstOrDefaultAsync(s => s.Id == q.ScanId, ct);
        if (scan is null) return Result.Failure<ScanDetailDto>(Error.NotFoundById("SeoCompetitorScan", q.ScanId));

        T Read<T>(string json) where T : new() { try { return JsonSerializer.Deserialize<T>(json, CompetitorMappings.Json) ?? new T(); } catch { return new T(); } }

        var plan = await db.PlanItems.AsNoTracking().Where(i => i.ScanId == scan.Id).OrderBy(i => i.PlannedDate).ToListAsync(ct);
        return Result.Success(new ScanDetailDto(
            CompetitorMappings.ToSummary(scan), Read<List<string>>(scan.CompetitorsJson), Read<List<TopicGapDto>>(scan.TopicGapsJson),
            Read<List<KeywordGapDto>>(scan.KeywordGapsJson), plan.Select(CompetitorMappings.ToDto).ToList()));
    }
}

internal sealed class DraftPlanItemHandler(SeoDbContext db, IArticleWriter writer) : ICommandHandler<DraftPlanItemCommand, PlanItemDto>
{
    public async Task<Result<PlanItemDto>> Handle(DraftPlanItemCommand cmd, CancellationToken ct)
    {
        var item = await db.PlanItems.FirstOrDefaultAsync(i => i.Id == cmd.Id, ct);
        if (item is null) return Result.Failure<PlanItemDto>(Error.NotFoundById("SeoPlanItem", cmd.Id));
        if (item.ArticleId is not null) return Result.Failure<PlanItemDto>(Error.Custom("PlanItem.Conflict", "A draft has already been written for this."));

        var site = await db.Sites.AsNoTracking().FirstOrDefaultAsync(s => s.Id == item.SiteId, ct);
        if (site is null) return Result.Failure<PlanItemDto>(Error.NotFoundById("SeoSite", item.SiteId));
        var settings = await db.ContentSettings.AsNoTracking().FirstOrDefaultAsync(s => s.SiteId == item.SiteId, ct);

        var ownTitles = await db.Pages.AsNoTracking().Where(p => p.SiteId == item.SiteId && p.Title != null)
            .OrderByDescending(p => p.Id).Select(p => p.Title!).Take(30).ToListAsync(ct);

        var detail = item.SearchVolume is { } v
            ? $"“{item.TargetKeyword}” — about {v:N0} searches a month. {item.Reason}"
            : $"“{item.TargetKeyword}” — {item.Reason}";
        var signals = new List<ResearchSignal> { new("competitor_topic", detail) };

        var written = await writer.WriteAsync(site.Domain, settings?.NicheHint ?? item.Title, ownTitles, signals, 1, settings?.TargetWordCount ?? 900, ct);
        var first = written.FirstOrDefault();
        if (first is null)
            return Result.Failure<PlanItemDto>(Error.Custom("PlanItem.Conflict",
                "The article could not be written. Check that an AI provider is set up under Settings → AI Assistant, then try again."));

        var article = new SeoArticle(site.Id, first.Title, first.Slug, first.MetaDescription,
            string.IsNullOrWhiteSpace(first.TargetKeyword) ? item.TargetKeyword : first.TargetKeyword, first.BodyMarkdown,
            JsonSerializer.Serialize(signals.Select(s => new { s.Kind, s.Detail }), CompetitorMappings.Json));
        db.Articles.Add(article);
        item.MarkDrafted(article.Id);
        await db.SaveChangesAsync(ct);
        return Result.Success(CompetitorMappings.ToDto(item));
    }
}

internal sealed class SkipPlanItemHandler(SeoDbContext db) : ICommandHandler<SkipPlanItemCommand, PlanItemDto>
{
    public async Task<Result<PlanItemDto>> Handle(SkipPlanItemCommand cmd, CancellationToken ct)
    {
        var item = await db.PlanItems.FirstOrDefaultAsync(i => i.Id == cmd.Id, ct);
        if (item is null) return Result.Failure<PlanItemDto>(Error.NotFoundById("SeoPlanItem", cmd.Id));
        if (item.ArticleId is not null) return Result.Failure<PlanItemDto>(Error.Custom("PlanItem.Conflict", "A draft was already written for this. Reject the draft instead."));
        item.Skip();
        await db.SaveChangesAsync(ct);
        return Result.Success(CompetitorMappings.ToDto(item));
    }
}
