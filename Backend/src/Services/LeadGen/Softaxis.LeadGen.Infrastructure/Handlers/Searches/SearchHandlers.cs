using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.LeadGen.Application.Abstractions;
using Softaxis.LeadGen.Application.Catalog;
using Softaxis.LeadGen.Application.Searches;
using Softaxis.LeadGen.Domain.Entities;
using Softaxis.LeadGen.Infrastructure.Handlers.Setup;
using Softaxis.LeadGen.Infrastructure.Persistence;
using Softaxis.LeadGen.Infrastructure.Providers;
using Softaxis.LeadGen.Infrastructure.Services;

namespace Softaxis.LeadGen.Infrastructure.Handlers.Searches;

internal static class SearchMapping
{
    public static SearchDto ToDto(SearchJob j, int revealed) => new(
        j.Id, j.Name, j.CountryCode, SearchRunner.ParseList(j.Regions), SearchRunner.ParseList(j.Areas),
        SearchRunner.ParseList(j.Categories), j.Keywords, j.MaxResults, j.Status, j.Error,
        j.FoundCount, j.NewCount, j.DuplicateCount, revealed, j.Progress, j.CreatedByName,
        j.CreatedAt, j.StartedAt, j.CompletedAt);

    public static async Task<Dictionary<Guid, int>> RevealedCountsAsync(LeadGenDbContext db, IEnumerable<Guid> ids, CancellationToken ct)
    {
        var list = ids.ToList();
        return await db.Prospects.AsNoTracking()
            .Where(p => !p.IsDeleted && p.IsRevealed && p.SearchJobId != null && list.Contains(p.SearchJobId!.Value))
            .GroupBy(p => p.SearchJobId!.Value).Select(g => new { g.Key, N = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.N, ct);
    }
}

internal sealed class GetSearchesHandler(LeadGenDbContext db) : IQueryHandler<GetSearchesQuery, IReadOnlyList<SearchDto>>
{
    public async Task<Result<IReadOnlyList<SearchDto>>> Handle(GetSearchesQuery q, CancellationToken ct)
    {
        var jobs = await db.Searches.AsNoTracking().Where(s => !s.IsDeleted).OrderByDescending(s => s.CreatedAt).Take(200).ToListAsync(ct);
        var revealed = await SearchMapping.RevealedCountsAsync(db, jobs.Select(j => j.Id), ct);
        return Result.Success<IReadOnlyList<SearchDto>>(jobs.Select(j => SearchMapping.ToDto(j, revealed.GetValueOrDefault(j.Id))).ToList());
    }
}

internal sealed class GetSearchByIdHandler(LeadGenDbContext db) : IQueryHandler<GetSearchByIdQuery, SearchDto>
{
    public async Task<Result<SearchDto>> Handle(GetSearchByIdQuery q, CancellationToken ct)
    {
        var j = await db.Searches.AsNoTracking().FirstOrDefaultAsync(s => s.Id == q.Id && !s.IsDeleted, ct);
        if (j is null) return Result.Failure<SearchDto>(Error.NotFoundById("Search", q.Id));
        var revealed = await SearchMapping.RevealedCountsAsync(db, [j.Id], ct);
        return Result.Success(SearchMapping.ToDto(j, revealed.GetValueOrDefault(j.Id)));
    }
}

internal static class SearchRules
{
    /// <summary>Everything a search must satisfy before it may run. Shared by the estimate and the real thing.</summary>
    public static async Task<Error?> CheckAsync(
        SearchInput i, PlatformSettings cfg, IPlacesClient places, LeadGenDbContext db, bool requireProvider, CancellationToken ct)
    {
        if (!cfg.Enabled) return Error.Custom("Search.Unavailable", "Lead generation is switched off on this platform.");

        var country = GeoCatalog.Get(i.CountryCode);
        if (country is null) return Error.Custom("Search.Invalid", "Unknown country.");
        if (!country.Live || !SetupSupport.AllowedCountries(cfg).Contains(country.Code, StringComparer.OrdinalIgnoreCase))
            return Error.Custom("Search.Unavailable", $"Searching in {country.Name} is not available yet.");

        foreach (var r in i.Regions)
            if (!country.Regions.Any(x => x.Name.Equals(r, StringComparison.OrdinalIgnoreCase)))
                return Error.Custom("Search.Invalid", $"\"{r}\" is not a region of {country.Name}.");

        if (i.MaxResults > cfg.MaxResultsPerSearch)
            return Error.Custom("Search.Invalid", $"A search can return at most {cfg.MaxResultsPerSearch} businesses.");

        if (requireProvider && !places.IsConfigured)
            return Error.Custom("Search.NotConfigured", "Business search is not set up on this server yet. Ask your administrator to add the data provider key.");

        var today = DateTime.UtcNow.Date;
        var searchesToday = await db.Searches.CountAsync(s => !s.IsDeleted && s.CreatedAt >= today, ct);
        if (searchesToday >= cfg.DailySearchLimit)
            return Error.Custom("Search.Conflict", $"You have used today's {cfg.DailySearchLimit} searches. More are available tomorrow.");

        var active = await db.Searches.CountAsync(s => !s.IsDeleted && (s.Status == SearchStatus.Queued || s.Status == SearchStatus.Running), ct);
        if (active >= 3)
            return Error.Custom("Search.Conflict", "Three searches are already running. Wait for one to finish.");

        return null;
    }
}

internal sealed class EstimateSearchHandler(LeadGenDbContext db, IPlatformSettings settings, IPlacesClient places)
    : IQueryHandler<EstimateSearchQuery, SearchEstimateDto>
{
    public async Task<Result<SearchEstimateDto>> Handle(EstimateSearchQuery q, CancellationToken ct)
    {
        var cfg = await settings.GetAsync(ct);
        var warnings = new List<string>();
        var error = await SearchRules.CheckAsync(q.Input, cfg, places, db, requireProvider: false, ct);
        if (error is not null) warnings.Add(error.Description);
        if (!places.IsConfigured) warnings.Add("Business search is not set up on this server yet.");

        var planned = SearchRunner.PlanQueries(q.Input.CountryCode, q.Input.Regions, q.Input.Areas ?? [], q.Input.Categories, q.Input.Keywords).Count;
        if (planned > 60) warnings.Add($"This makes {planned} separate lookups and may take several minutes. Narrow the areas or categories to go faster.");

        var today = DateTime.UtcNow.Date;
        var searchesToday = await db.Searches.CountAsync(s => !s.IsDeleted && s.CreatedAt >= today, ct);
        var discoveredToday = await db.Prospects.CountAsync(p => p.SearchJobId != null && p.CreatedAt >= today, ct);

        return Result.Success(new SearchEstimateDto(
            planned, Math.Min(q.Input.MaxResults, cfg.MaxResultsPerSearch),
            Math.Max(0, cfg.DailySearchLimit - searchesToday), Math.Max(0, cfg.DailyDiscoveryLimit - discoveredToday),
            places.IsConfigured, warnings));
    }
}

internal sealed class CreateSearchHandler(LeadGenDbContext db, IPlatformSettings settings, IPlacesClient places, ICurrentUser user)
    : ICommandHandler<CreateSearchCommand, SearchDto>
{
    public async Task<Result<SearchDto>> Handle(CreateSearchCommand cmd, CancellationToken ct)
    {
        var i = cmd.Input;
        var cfg = await settings.GetAsync(ct);
        var error = await SearchRules.CheckAsync(i, cfg, places, db, requireProvider: true, ct);
        if (error is not null) return Result.Failure<SearchDto>(error);

        var regions = i.Regions.Select(r => GeoCatalog.Region(i.CountryCode, r)!.Name).Distinct().ToList();
        var areas = (i.Areas ?? []).Where(a => !string.IsNullOrWhiteSpace(a)).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        var cats = i.Categories.Distinct(StringComparer.OrdinalIgnoreCase).ToList();

        var job = new SearchJob(i.Name, i.CountryCode, JsonSerializer.Serialize(regions),
            areas.Count == 0 ? null : JsonSerializer.Serialize(areas), JsonSerializer.Serialize(cats),
            i.Keywords, i.MaxResults, user.Id, user.Name);
        db.Searches.Add(job);
        await db.SaveChangesAsync(ct);
        return Result.Success(SearchMapping.ToDto(job, 0));
    }
}

internal sealed class CancelSearchHandler(LeadGenDbContext db) : ICommandHandler<CancelSearchCommand>
{
    public async Task<Result> Handle(CancelSearchCommand cmd, CancellationToken ct)
    {
        var j = await db.Searches.FirstOrDefaultAsync(s => s.Id == cmd.Id && !s.IsDeleted, ct);
        if (j is null) return Result.Failure(Error.NotFoundById("Search", cmd.Id));
        if (j.Status is SearchStatus.Completed or SearchStatus.Failed or SearchStatus.Cancelled)
            return Result.Failure(Error.Custom("Search.Conflict", "This search has already finished."));
        j.Cancel();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class DeleteSearchHandler(LeadGenDbContext db) : ICommandHandler<DeleteSearchCommand>
{
    public async Task<Result> Handle(DeleteSearchCommand cmd, CancellationToken ct)
    {
        var j = await db.Searches.FirstOrDefaultAsync(s => s.Id == cmd.Id && !s.IsDeleted, ct);
        if (j is null) return Result.Failure(Error.NotFoundById("Search", cmd.Id));
        if (j.Status == SearchStatus.Running)
            return Result.Failure(Error.Custom("Search.Conflict", "Cancel the search before deleting it."));

        if (cmd.DeleteUnrevealedProspects)
        {
            // Only teasers go. A revealed prospect was paid for and may be in a campaign or the CRM.
            var teasers = await db.Prospects.Where(p => p.SearchJobId == j.Id && !p.IsDeleted && !p.IsRevealed).ToListAsync(ct);
            foreach (var p in teasers) p.Delete();
        }
        j.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
