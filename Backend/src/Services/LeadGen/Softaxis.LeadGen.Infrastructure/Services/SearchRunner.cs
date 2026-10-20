using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.Notifications;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.LeadGen.Application.Catalog;
using Softaxis.LeadGen.Domain.Entities;
using Softaxis.LeadGen.Infrastructure.Persistence;
using Softaxis.LeadGen.Infrastructure.Providers;

namespace Softaxis.LeadGen.Infrastructure.Services;

/// <summary>
/// Runs one discovery search. A provider returns at most a few dozen results per query, so a search
/// is split into many small ones — one per (area, category) — and read page by page, interleaved so
/// that stopping early still gives a spread across everything the user asked for rather than only
/// the first area.
///
/// Every business found is added to the shared directory (so the next workspace gets it fresher and
/// cheaper) and to the workspace as a locked prospect. Nothing here costs the workspace credits; the
/// daily caps in the platform settings are what keep it from costing us more than it earns.
/// </summary>
internal sealed class SearchRunner(
    LeadGenDbContext db, IPlacesClient places, IPlatformSettings settings,
    INotificationDispatcher dispatcher, ILogger<SearchRunner> logger)
{
    private sealed class Plan
    {
        public required string Query { get; init; }
        public required string Label { get; init; }
        public required RegionInfo Region { get; init; }
        public required BusinessCategory Category { get; init; }
        public string? Area { get; init; }
        public string? NextToken { get; set; }
        public bool Done { get; set; }
    }

    public static IReadOnlyList<(string Query, string Label)> PlanQueries(
        string countryCode, IEnumerable<string> regions, IEnumerable<string> areas,
        IEnumerable<string> categories, string? keywords)
    {
        var country = GeoCatalog.Get(countryCode);
        var result = new List<(string, string)>();
        foreach (var plan in BuildPlans(country, regions, areas, categories, keywords)) result.Add((plan.Query, plan.Label));
        return result;
    }

    private static List<Plan> BuildPlans(CountryInfo? country, IEnumerable<string> regions, IEnumerable<string> areas,
        IEnumerable<string> categories, string? keywords)
    {
        var plans = new List<Plan>();
        if (country is null) return plans;
        var areaList = areas.ToList(); var catList = categories.Select(CategoryCatalog.Get).Where(c => c is not null).Select(c => c!).ToList();
        var extra = string.IsNullOrWhiteSpace(keywords) ? "" : " " + keywords.Trim();

        foreach (var regionName in regions)
        {
            var region = country.Regions.FirstOrDefault(r => r.Name.Equals(regionName, StringComparison.OrdinalIgnoreCase));
            if (region is null) continue;
            var targets = areaList.Where(a => region.Areas.Contains(a, StringComparer.OrdinalIgnoreCase)).ToList();
            if (targets.Count == 0) targets.Add(null!);   // the whole region

            foreach (var area in targets)
                foreach (var cat in catList)
                {
                    var where = area is null ? $"{region.Name}, {country.Name}" : $"{area}, {region.Name}, {country.Name}";
                    plans.Add(new Plan
                    {
                        Query = $"{cat.Query}{extra} in {where}", Label = area is null ? $"{region.Name} · {cat.Label}" : $"{area} · {cat.Label}",
                        Region = region, Category = cat, Area = area,
                    });
                }
        }
        return plans;
    }

    public async Task RunAsync(Guid jobId, CancellationToken ct)
    {
        var job = await db.Searches.FirstOrDefaultAsync(j => j.Id == jobId && !j.IsDeleted, ct);
        if (job is null) return;

        var cfg = await settings.GetAsync(ct);
        var country = GeoCatalog.Get(job.CountryCode);
        var profile = await db.Profiles.AsNoTracking().FirstOrDefaultAsync(ct);
        var scoreProfile = ProspectSupport.ProfileFor(profile);

        var regions = ParseList(job.Regions); var areas = ParseList(job.Areas); var cats = ParseList(job.Categories);
        var plans = BuildPlans(country, regions, areas, cats, job.Keywords);

        int found = 0, added = 0, duplicates = 0, requests = 0;
        string? stopNote = null;

        if (!cfg.Enabled) { await FailAsync(job, "Lead generation is switched off on this platform.", found, added, duplicates, requests, ct); return; }
        if (plans.Count == 0) { await FailAsync(job, "Nothing to search for with those choices.", found, added, duplicates, requests, ct); return; }

        var since = DateTime.UtcNow.Date;
        var discoveredToday = await db.Prospects.CountAsync(p => p.SearchJobId != null && p.CreatedAt >= since, ct);
        var budget = Math.Min(job.MaxResults, Math.Max(0, cfg.DailyDiscoveryLimit - discoveredToday));
        if (budget <= 0) { await FailAsync(job, "Today's discovery limit has been reached. Try again tomorrow.", found, added, duplicates, requests, ct); return; }

        job.Start();
        await db.SaveChangesAsync(ct);

        var seen = new HashSet<string>(StringComparer.Ordinal);

        try
        {
            // Up to three pages (20 results each) per query — the provider's own ceiling.
            for (var pass = 0; pass < 3 && found < budget; pass++)
            {
                foreach (var plan in plans)
                {
                    if (found >= budget) break;
                    if (plan.Done) continue;
                    ct.ThrowIfCancellationRequested();

                    // Honour a cancel made while we were working.
                    await db.Entry(job).ReloadAsync(ct);
                    if (job.Status == SearchStatus.Cancelled) { stopNote = "cancelled"; goto finish; }

                    PlacesPage page;
                    try
                    {
                        page = await places.SearchTextAsync(plan.Query, job.CountryCode, plan.Region.Lat, plan.Region.Lng,
                            plan.Region.RadiusMeters, pass == 0 ? null : plan.NextToken, ct);
                        requests++;
                    }
                    catch (PlacesException ex) when (!ex.Fatal)
                    {
                        // One bad query must not sink the whole search.
                        logger.LogWarning("Search query skipped ({Query}): {Message}", plan.Query, ex.Message);
                        plan.Done = true; continue;
                    }

                    plan.NextToken = page.NextPageToken;
                    if (string.IsNullOrEmpty(page.NextPageToken)) plan.Done = true;

                    var (f, a, d) = await StoreAsync(page.Places, plan, job, country, scoreProfile, seen, budget - found, ct);
                    found += f; added += a; duplicates += d;

                    job.ReportProgress($"{plan.Label} — {found} found", requests);
                    await db.SaveChangesAsync(ct);
                    await Task.Delay(120, ct);   // be gentle with the provider
                }
                if (plans.All(p => p.Done)) break;
            }
        }
        catch (PlacesException ex) when (ex.Fatal)
        {
            await FailAsync(job, ex.Message, found, added, duplicates, requests, ct);
            return;
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            // The service is shutting down. Put the job back so it resumes on the next start.
            job.Requeue();
            await db.SaveChangesAsync(CancellationToken.None);
            return;
        }

        finish:
        if (stopNote == "cancelled")
        {
            await db.SaveChangesAsync(ct);
            return;
        }

        job.Complete(found, added, duplicates, requests);
        await db.SaveChangesAsync(ct);
        await NotifyAsync(job, ct);
    }

    private async Task<(int found, int added, int duplicates)> StoreAsync(
        IReadOnlyList<PlaceResult> results, Plan plan, SearchJob job, CountryInfo? country,
        Application.Scoring.ScoreProfile? profile, HashSet<string> seen, int room, CancellationToken ct)
    {
        var fresh = results.Where(r => seen.Add(r.Id)).ToList();
        if (fresh.Count == 0) return (0, 0, 0);

        var ids = fresh.Select(r => r.Id).ToList();
        var directory = await db.Directory.Where(d => ids.Contains(d.GooglePlaceId)).ToDictionaryAsync(d => d.GooglePlaceId, ct);
        var existing = (await db.Prospects.AsNoTracking().Where(p => !p.IsDeleted && p.GooglePlaceId != null && ids.Contains(p.GooglePlaceId!))
            .Select(p => p.GooglePlaceId!).ToListAsync(ct)).ToHashSet();

        var selectedRegions = ParseList(job.Regions);
        int found = 0, added = 0, duplicates = 0;
        foreach (var r in fresh)
        {
            if (found >= room) break;
            if (r.BusinessStatus == "CLOSED_PERMANENTLY") continue;
            if (country is not null && r.CountryName is not null && !r.CountryName.Equals(country.Name, StringComparison.OrdinalIgnoreCase)) continue;
            // Google's region text ("Dubai", "Abu Dhabi Emirate") must match one of the regions asked for;
            // a text query for "Deira, Dubai" can otherwise return a place just over the border.
            if (r.Region is not null && !selectedRegions.Any(sel =>
                    r.Region.Contains(sel, StringComparison.OrdinalIgnoreCase) || sel.Contains(r.Region, StringComparison.OrdinalIgnoreCase))) continue;

            found++;
            var phone = PhoneNormalizer.Normalize(r.InternationalPhone ?? r.Phone, job.CountryCode);
            var domain = ProspectSupport.DomainOf(r.Website);

            if (!directory.TryGetValue(r.Id, out var entry))
            {
                entry = new BusinessDirectoryEntry(r.Id, r.Name, job.CountryCode);
                db.Directory.Add(entry); directory[r.Id] = entry;
            }
            entry.Refresh(r.Name, plan.Category.Key, r.PrimaryType, r.Region, r.City, r.Area ?? plan.Area, r.Address, r.Lat, r.Lng,
                r.Phone ?? r.InternationalPhone, phone?.E164, phone?.Type, r.Website, domain, r.Rating, r.ReviewCount, r.BusinessStatus, r.MapsUri);

            if (existing.Contains(r.Id)) { duplicates++; continue; }

            var p = new Prospect(job.Id, r.Name, job.CountryCode);
            p.SetListing(entry.Id, plan.Category.Key, r.PrimaryTypeLabel ?? r.PrimaryType, r.Region ?? plan.Region.Name, r.City, r.Area ?? plan.Area,
                r.Address, r.Lat, r.Lng, phone?.Display ?? r.Phone, phone?.E164, phone?.Type, r.Website, domain, r.Rating,
                r.ReviewCount, r.BusinessStatus, r.MapsUri, r.Id);
            var s = ProspectSupport.ScoreOf(p, profile);
            p.SetScores(s.Quality, s.Fit, Application.Scoring.ProspectScoring.NotesJson(s.Notes));
            db.Prospects.Add(p);
            added++;
        }
        return (found, added, duplicates);
    }

    private async Task FailAsync(SearchJob job, string message, int found, int added, int duplicates, int requests, CancellationToken ct)
    {
        job.Fail(message, found, added, duplicates, requests);
        await db.SaveChangesAsync(ct);
        await NotifyAsync(job, ct);
    }

    private async Task NotifyAsync(SearchJob job, CancellationToken ct)
    {
        try
        {
            if (job.CreatedByUserId is not { } user) return;
            var ok = job.Status == SearchStatus.Completed;
            await dispatcher.PublishAsync(new NotificationRequest(
                user, NotificationModules.LeadGen, NotificationEvents.LeadGenSearchDone,
                ok ? "Your search is ready" : "Your search could not finish",
                ok ? $"\"{job.Name}\" found {job.FoundCount} businesses, {job.NewCount} new to you."
                   : $"\"{job.Name}\": {job.Error}",
                Link: $"/lead-generation/prospects?search={job.Id}", Type: ok ? "success" : "warning",
                RelatedToType: "leadgen-search", RelatedToId: job.Id, TenantId: TenantAmbient.TenantId), ct);
        }
        catch (Exception ex) { logger.LogWarning(ex, "Search notification failed."); }
    }

    internal static List<string> ParseList(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try { return JsonSerializer.Deserialize<List<string>>(json) ?? []; } catch { return []; }
    }
}
