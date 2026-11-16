using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Seo.Application.Profile;
using Softaxis.Seo.Domain.Entities;
using Softaxis.Seo.Infrastructure.Competitors;
using Softaxis.Seo.Infrastructure.Credits;
using Softaxis.Seo.Infrastructure.Crawl;
using Softaxis.Seo.Infrastructure.Persistence;
using Softaxis.Seo.Infrastructure.Profile;

namespace Softaxis.Seo.Infrastructure.Handlers.Profile;

internal static class ProfileMappings
{
    public static BusinessProfileDto ToDto(SeoSite site, SeoBusinessProfile? p, BusinessContext? ctx) => new(
        // "Exists" means there is something written, not just a row waiting for the automatic read to finish.
        site.Id, p is { Summary.Length: > 0 }, ctx is not null, ctx is not null && !(p is { IsReady: true, IsDraft: false }),
        p?.BusinessName is { Length: > 0 } n ? n : site.DisplayName,
        p?.Industry ?? "", p?.Summary ?? "", p?.Offers ?? [], p?.Audience ?? "", p?.ServiceAreas ?? "", p?.AvoidTopics ?? [],
        p?.Source ?? ProfileSources.Manual, p?.ImportedFromTenantAt, p?.UpdatedAt,
        p?.IsDraft ?? false, p?.AutofillStatus ?? AutofillStatuses.None, p?.AutofillNote);
}

internal sealed class GetBusinessProfileHandler(SeoDbContext db) : IQueryHandler<GetBusinessProfileQuery, BusinessProfileDto>
{
    public async Task<Result<BusinessProfileDto>> Handle(GetBusinessProfileQuery q, CancellationToken ct)
    {
        var site = await db.Sites.AsNoTracking().FirstOrDefaultAsync(s => s.Id == q.SiteId, ct);
        if (site is null) return Result.Failure<BusinessProfileDto>(Error.NotFoundById("SeoSite", q.SiteId));
        var p = await db.BusinessProfiles.AsNoTracking().FirstOrDefaultAsync(x => x.SiteId == q.SiteId, ct);
        var ctx = await BusinessContextLoader.LoadAsync(db, site, ct);
        return Result.Success(ProfileMappings.ToDto(site, p, ctx));
    }
}

internal sealed class SaveBusinessProfileHandler(SeoDbContext db) : ICommandHandler<SaveBusinessProfileCommand, BusinessProfileDto>
{
    public async Task<Result<BusinessProfileDto>> Handle(SaveBusinessProfileCommand cmd, CancellationToken ct)
    {
        var site = await db.Sites.AsNoTracking().FirstOrDefaultAsync(s => s.Id == cmd.SiteId, ct);
        if (site is null) return Result.Failure<BusinessProfileDto>(Error.NotFoundById("SeoSite", cmd.SiteId));

        var p = await db.BusinessProfiles.FirstOrDefaultAsync(x => x.SiteId == cmd.SiteId, ct);
        if (p is null) { p = new SeoBusinessProfile(cmd.SiteId); db.BusinessProfiles.Add(p); }

        // "tenant" is only ever set by the import; everything typed or edited by a person is theirs.
        var source = cmd.Source == ProfileSources.Website ? ProfileSources.Website : ProfileSources.Manual;
        p.Update(cmd.BusinessName, cmd.Industry, cmd.Summary, cmd.Offers, cmd.Audience, cmd.ServiceAreas, cmd.AvoidTopics, source);
        await db.SaveChangesAsync(ct);

        var ctx = await BusinessContextLoader.LoadAsync(db, site, ct);
        return Result.Success(ProfileMappings.ToDto(site, p, ctx));
    }
}

internal sealed class GetTenantProfilePreviewHandler(SeoDbContext db, ITenantBusinessReader reader)
    : IQueryHandler<GetTenantProfilePreviewQuery, TenantProfilePreviewDto>
{
    public async Task<Result<TenantProfilePreviewDto>> Handle(GetTenantProfilePreviewQuery q, CancellationToken ct)
    {
        var site = await db.Sites.AsNoTracking().FirstOrDefaultAsync(s => s.Id == q.SiteId, ct);
        if (site is null) return Result.Failure<TenantProfilePreviewDto>(Error.NotFoundById("SeoSite", q.SiteId));

        var details = TenantAmbient.TenantId is { } tid ? await reader.GetAsync(tid, ct) : null;
        var prop = TenantProfileMapper.Propose(details);
        return Result.Success(new TenantProfilePreviewDto(
            prop.Enough, prop.Missing, prop.NotInWorkspace,
            details?.Name, details?.Industry is null ? null : prop.Industry, prop.ServiceAreas.Length > 0 ? prop.ServiceAreas : null, details?.Website,
            site.Domain, TenantProfileMapper.WebsiteMatches(details?.Website, site.Domain), prop.Summary, prop.ServiceAreas));
    }
}

internal sealed class ImportBusinessProfileFromTenantHandler(SeoDbContext db, ITenantBusinessReader reader)
    : ICommandHandler<ImportBusinessProfileFromTenantCommand, BusinessProfileDto>
{
    public async Task<Result<BusinessProfileDto>> Handle(ImportBusinessProfileFromTenantCommand cmd, CancellationToken ct)
    {
        var site = await db.Sites.AsNoTracking().FirstOrDefaultAsync(s => s.Id == cmd.SiteId, ct);
        if (site is null) return Result.Failure<BusinessProfileDto>(Error.NotFoundById("SeoSite", cmd.SiteId));
        if (TenantAmbient.TenantId is not { } tenantId)
            return Result.Failure<BusinessProfileDto>(Error.Custom("Validation.Failed", "Could not work out which workspace this is."));

        var prop = TenantProfileMapper.Propose(await reader.GetAsync(tenantId, ct));
        if (!prop.Enough)
            return Result.Failure<BusinessProfileDto>(Error.Custom("Validation.Failed",
                $"Your workspace does not have enough company details to import yet. Missing: {string.Join(", ", prop.Missing)}. Add them in Settings → General, or fill this profile in by hand."));

        var p = await db.BusinessProfiles.FirstOrDefaultAsync(x => x.SiteId == cmd.SiteId, ct);
        if (p is not null && p.IsReady && !p.IsDraft && !cmd.Overwrite)
            return Result.Failure<BusinessProfileDto>(Error.Custom("BusinessProfile.Conflict", "This website already has a business profile. Confirm to replace its name, industry and description with your workspace's."));

        if (p is null) { p = new SeoBusinessProfile(cmd.SiteId); db.BusinessProfiles.Add(p); }
        // The workspace knows who the company is, not what it sells to whom: keep whatever a person already wrote for those.
        p.Update(prop.Name, prop.Industry, prop.Summary, p.Offers, p.Audience, prop.ServiceAreas.Length > 0 ? prop.ServiceAreas : p.ServiceAreas, p.AvoidTopics, ProfileSources.Tenant);
        await db.SaveChangesAsync(ct);

        var ctx = await BusinessContextLoader.LoadAsync(db, site, ct);
        return Result.Success(ProfileMappings.ToDto(site, p, ctx));
    }
}

internal sealed class DraftBusinessProfileFromSiteHandler(SeoDbContext db, SiteTextReader reader, IBusinessProfileDrafter drafter)
    : ICommandHandler<DraftBusinessProfileFromSiteCommand, BusinessProfileDraftDto>
{
    public async Task<Result<BusinessProfileDraftDto>> Handle(DraftBusinessProfileFromSiteCommand cmd, CancellationToken ct)
    {
        var site = await db.Sites.AsNoTracking().FirstOrDefaultAsync(s => s.Id == cmd.SiteId, ct);
        if (site is null) return Result.Failure<BusinessProfileDraftDto>(Error.NotFoundById("SeoSite", cmd.SiteId));

        var pages = await reader.ReadAsync(site.Domain, ct);
        if (pages.Count == 0 || pages.All(p => p.Body.Length < 40))
            return Result.Failure<BusinessProfileDraftDto>(Error.Custom("Validation.Failed",
                $"We could not read any text from {site.Domain}. It may block automated visitors or load its words with scripts. Fill the profile in by hand instead."));

        try { return Result.Success(await drafter.DraftAsync(pages, ct)); }
        catch (InvalidOperationException ex) { return Result.Failure<BusinessProfileDraftDto>(Error.Custom("Validation.Failed", ex.Message)); }
    }
}

internal sealed class RequestProfileAutofillHandler(SeoDbContext db, IProfileAutofillQueue queue)
    : ICommandHandler<RequestProfileAutofillCommand, BusinessProfileDto>
{
    public async Task<Result<BusinessProfileDto>> Handle(RequestProfileAutofillCommand cmd, CancellationToken ct)
    {
        var site = await db.Sites.AsNoTracking().FirstOrDefaultAsync(s => s.Id == cmd.SiteId, ct);
        if (site is null) return Result.Failure<BusinessProfileDto>(Error.NotFoundById("SeoSite", cmd.SiteId));
        if (TenantAmbient.TenantId is not { } tenantId)
            return Result.Failure<BusinessProfileDto>(Error.Custom("Validation.Failed", "Could not work out which workspace this is."));

        var p = await db.BusinessProfiles.FirstOrDefaultAsync(x => x.SiteId == cmd.SiteId, ct);
        // Something a person wrote or confirmed is theirs; it is never replaced by a guess.
        if (p is { IsReady: true, IsDraft: false })
            return Result.Failure<BusinessProfileDto>(Error.Custom("BusinessProfile.Conflict", "This website already has a confirmed business profile."));

        if (p is { AutofillStatus: AutofillStatuses.Pending })
            return Result.Success(ProfileMappings.ToDto(site, p, await BusinessContextLoader.LoadAsync(db, site, ct)));

        if (p is null) { p = SeoBusinessProfile.CreatePending(site.Id, site.DisplayName); db.BusinessProfiles.Add(p); }
        else p.RequestAutofill();
        await db.SaveChangesAsync(ct);

        queue.Enqueue(tenantId, site.Id);
        return Result.Success(ProfileMappings.ToDto(site, p, await BusinessContextLoader.LoadAsync(db, site, ct)));
    }
}

internal sealed class SuggestCompetitorsHandler(SeoDbContext db, IKeywordDataProvider keywords, ISeoCreditService credits, SeoOptions options)
    : ICommandHandler<SuggestCompetitorsCommand, SuggestedCompetitorsDto>
{
    public async Task<Result<SuggestedCompetitorsDto>> Handle(SuggestCompetitorsCommand cmd, CancellationToken ct)
    {
        var site = await db.Sites.AsNoTracking().FirstOrDefaultAsync(s => s.Id == cmd.SiteId, ct);
        if (site is null) return Result.Failure<SuggestedCompetitorsDto>(Error.NotFoundById("SeoSite", cmd.SiteId));
        if (!keywords.IsConfigured)
            return Result.Failure<SuggestedCompetitorsDto>(Error.Custom("Validation.Failed", "Competitor suggestions need search-volume data, which is not switched on for this platform yet."));

        var location = cmd.LocationCode ?? CompetitorLocations.Default;
        if (!CompetitorLocations.IsKnown(location))
            return Result.Failure<SuggestedCompetitorsDto>(Error.Custom("Validation.Failed", "Choose one of the listed countries."));

        var cost = options.CreditsPerCompetitorKeywords;
        var balance = await credits.BalanceAsync(ct);
        if (balance < cost)
            return Result.Failure<SuggestedCompetitorsDto>(Error.Custom("Credits.Insufficient", $"Finding competitors uses {cost} credits and you have {balance}. Buy more in Settings → Billing."));

        IReadOnlyList<CompetitorDomainRow> rows;
        try { rows = await keywords.CompetitorDomainsAsync(site.Domain, location, ct); }
        catch (KeywordProviderException ex) { return Result.Failure<SuggestedCompetitorsDto>(Error.Custom("Validation.Failed", ex.Message)); }

        // Nothing was returned for a site with no search presence yet — that is an answer, but not one worth charging for.
        if (rows.Count == 0)
            return Result.Success(new SuggestedCompetitorsDto([], 0,
                "No websites were found that rank for the same searches yet. A newer site with little search visibility has nothing to compare with — add competitors you know by hand."));

        var existing = await db.Competitors.AsNoTracking().Where(c => c.SiteId == cmd.SiteId).Select(c => c.Domain).ToListAsync(ct);
        var picked = CompetitorSuggestions.Filter(rows, site.Domain, existing);

        var spend = await credits.TrySpendAsync(cost, "Competitor suggestions", "competitor-suggest", cmd.SiteId, $"competitor-suggest:{Guid.NewGuid()}", ct);
        if (!spend.Ok)
            return Result.Failure<SuggestedCompetitorsDto>(Error.Custom("Credits.Insufficient", "There were not enough credits to finish this. Nothing was charged."));

        return Result.Success(new SuggestedCompetitorsDto(
            picked.Select(r => new SuggestedCompetitorDto(r.Domain, r.SharedKeywords, r.AveragePosition)).ToList(), cost,
            picked.Count == 0 ? "Websites were found, but none looked like a business you compete with (networks, marketplaces and directories are left out)." : null));
    }
}
