using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.LeadGen.Application;
using Softaxis.LeadGen.Application.Abstractions;
using Softaxis.LeadGen.Application.Catalog;
using Softaxis.LeadGen.Application.Scoring;
using Softaxis.LeadGen.Application.Setup;
using Softaxis.LeadGen.Domain.Entities;
using Softaxis.LeadGen.Infrastructure.Persistence;
using Softaxis.LeadGen.Infrastructure.Providers;
using Softaxis.LeadGen.Infrastructure.Services;

namespace Softaxis.LeadGen.Infrastructure.Handlers.Setup;

internal static class SetupSupport
{
    public static IReadOnlyList<string> AllowedCountries(PlatformSettings s)
    {
        try { return JsonSerializer.Deserialize<List<string>>(s.AllowedCountries) ?? []; } catch { return []; }
    }

    /// <summary>The workspace's profile, created empty on first read — never at startup.</summary>
    public static async Task<LeadGenProfile> ProfileAsync(LeadGenDbContext db, CancellationToken ct)
    {
        var p = await db.Profiles.FirstOrDefaultAsync(ct);
        if (p is not null) return p;
        try
        {
            p = LeadGenProfile.CreateEmpty();
            db.Profiles.Add(p);
            await db.SaveChangesAsync(ct);
            return p;
        }
        catch (DbUpdateException)
        {
            db.ChangeTracker.Clear();
            return await db.Profiles.FirstAsync(ct);
        }
    }

    public static ProfileDto ToDto(LeadGenProfile p) => new(
        p.OfferSummary, p.TargetCustomers, p.DealSize, p.CountryCode,
        ProspectScoring.ParseList(p.PreferredRegions), ProspectScoring.ParseList(p.PreferredCategories), p.ExcludeKeywords,
        p.SenderBusinessName, p.SenderAddress, p.SenderWebsite);
}

internal sealed class GetMetaHandler(
    LeadGenDbContext db, IPlatformSettings settings, ICreditService credits, IPlacesClient places,
    IEmailChecker emails, IOutreachPolicy policy) : IQueryHandler<GetMetaQuery, MetaDto>
{
    public async Task<Result<MetaDto>> Handle(GetMetaQuery q, CancellationToken ct)
    {
        var cfg = await settings.GetAsync(ct);
        var wallet = await credits.EnsureWalletAsync(ct);
        var profile = await db.Profiles.AsNoTracking().FirstOrDefaultAsync(ct);
        var allowed = SetupSupport.AllowedCountries(cfg);

        var today = DateTime.UtcNow.Date;
        var searchesToday = await db.Searches.CountAsync(s => !s.IsDeleted && s.CreatedAt >= today, ct);
        var discoveredToday = await db.Prospects.CountAsync(p => p.SearchJobId != null && p.CreatedAt >= today, ct);
        var sentToday = await db.Messages.CountAsync(m => m.Direction == MessageDirection.Out && m.Status == MessageStatus.Sent && m.OccurredAt >= today, ct);
        var send = await policy.CanSendAsync(ct);

        var countries = GeoCatalog.All.Select(c => new CountryDto(
            c.Code, c.Name, c.NameAr, c.Live, c.Live && allowed.Contains(c.Code, StringComparer.OrdinalIgnoreCase),
            c.ComplianceNote, c.Timezone, c.WorkingDays,
            c.Regions.Select(r => new RegionDto(r.Name, r.NameAr, r.Areas)).ToList())).ToList();

        var categories = CategoryCatalog.All.Select(c => new CategoryDto(c.Key, c.Label, c.LabelAr, c.Group)).ToList();

        var limits = new LimitsDto(
            cfg.RevealCost, cfg.VerifiedEmailBonus, cfg.MaxResultsPerSearch, cfg.MaxRevealsPerRequest,
            cfg.DailySearchLimit, searchesToday, cfg.DailyDiscoveryLimit, discoveredToday,
            cfg.MaxMailboxesPerWorkspace, cfg.MaxDailySendsPerMailbox, cfg.MaxDailySendsPerWorkspace, sentToday, cfg.BounceRefundDays);

        return Result.Success(new MetaDto(
            cfg.Enabled, places.IsConfigured, emails.ProviderConfigured, profile?.CountryCode ?? "AE",
            countries, categories, limits, wallet.Balance, send.Ok, send.Reason, send.SenderIdentityReady));
    }
}

internal sealed class GetProfileHandler(LeadGenDbContext db) : IQueryHandler<GetProfileQuery, ProfileDto>
{
    public async Task<Result<ProfileDto>> Handle(GetProfileQuery q, CancellationToken ct) =>
        Result.Success(SetupSupport.ToDto(await SetupSupport.ProfileAsync(db, ct)));
}

internal sealed class UpdateProfileHandler(LeadGenDbContext db) : ICommandHandler<UpdateProfileCommand, ProfileDto>
{
    public async Task<Result<ProfileDto>> Handle(UpdateProfileCommand cmd, CancellationToken ct)
    {
        var i = cmd.Input;
        if (GeoCatalog.Get(i.CountryCode) is null)
            return Result.Failure<ProfileDto>(Error.Custom("Profile.Invalid", "Unknown country."));

        var regions = (i.PreferredRegions ?? []).Where(r => !string.IsNullOrWhiteSpace(r)).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        var cats = (i.PreferredCategories ?? []).Where(CategoryCatalog.IsValid).Distinct(StringComparer.OrdinalIgnoreCase).ToList();

        var profile = await SetupSupport.ProfileAsync(db, ct);
        profile.Update(i.OfferSummary, i.TargetCustomers, i.DealSize, i.CountryCode,
            regions.Count == 0 ? null : JsonSerializer.Serialize(regions),
            cats.Count == 0 ? null : JsonSerializer.Serialize(cats),
            i.ExcludeKeywords, i.SenderBusinessName, i.SenderAddress, i.SenderWebsite);
        await db.SaveChangesAsync(ct);
        return Result.Success(SetupSupport.ToDto(profile));
    }
}

// ── Suppression ──────────────────────────────────────────────────────────────────────────────

internal sealed class GetSuppressionHandler(LeadGenDbContext db) : IQueryHandler<GetSuppressionQuery, PagedResult<SuppressionDto>>
{
    public async Task<Result<PagedResult<SuppressionDto>>> Handle(GetSuppressionQuery q, CancellationToken ct)
    {
        var page = Math.Max(1, q.Page); var size = Math.Clamp(q.PageSize, 1, 200);
        var query = db.Suppressions.AsNoTracking().Where(s => !s.IsDeleted);
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim().ToLowerInvariant();
            query = query.Where(x => x.Value.Contains(s));
        }
        var total = await query.CountAsync(ct);
        var items = await query.OrderByDescending(s => s.CreatedAt).Skip((page - 1) * size).Take(size)
            .Select(s => new SuppressionDto(s.Id, s.Kind, s.Value, s.Reason, s.Source, s.CreatedAt)).ToListAsync(ct);
        return Result.Success(new PagedResult<SuppressionDto>(items, total, page, size));
    }
}

internal sealed class AddSuppressionHandler(LeadGenDbContext db, ICurrentUser user)
    : ICommandHandler<AddSuppressionCommand, SuppressionDto>
{
    public async Task<Result<SuppressionDto>> Handle(AddSuppressionCommand cmd, CancellationToken ct)
    {
        var value = SuppressionEntry.Normalize(cmd.Kind, cmd.Value);
        if (value.Length == 0) return Result.Failure<SuppressionDto>(Error.Custom("Suppression.Invalid", "Enter a value."));

        var existing = await db.Suppressions.FirstOrDefaultAsync(s => s.Kind == cmd.Kind && s.Value == value && !s.IsDeleted, ct);
        if (existing is not null)
            return Result.Success(new SuppressionDto(existing.Id, existing.Kind, existing.Value, existing.Reason, existing.Source, existing.CreatedAt));

        var reason = string.IsNullOrWhiteSpace(cmd.Reason) ? SuppressionReason.Manual : cmd.Reason.Trim();
        var entry = new SuppressionEntry(cmd.Kind, value, reason.Length > 30 ? reason[..30] : reason, "manual", user.Id);
        db.Suppressions.Add(entry);
        await db.SaveChangesAsync(ct);
        await SuppressionSupport.MarkProspectsAsync(db, cmd.Kind, value, ct);
        return Result.Success(new SuppressionDto(entry.Id, entry.Kind, entry.Value, entry.Reason, entry.Source, entry.CreatedAt));
    }
}

internal sealed class RemoveSuppressionHandler(LeadGenDbContext db) : ICommandHandler<RemoveSuppressionCommand>
{
    public async Task<Result> Handle(RemoveSuppressionCommand cmd, CancellationToken ct)
    {
        var e = await db.Suppressions.FirstOrDefaultAsync(s => s.Id == cmd.Id && !s.IsDeleted, ct);
        if (e is null) return Result.Failure(Error.NotFoundById("Suppression", cmd.Id));
        e.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class ImportSuppressionHandler(LeadGenDbContext db, ICurrentUser user)
    : ICommandHandler<ImportSuppressionCommand, ImportSuppressionResult>
{
    public async Task<Result<ImportSuppressionResult>> Handle(ImportSuppressionCommand cmd, CancellationToken ct)
    {
        var wanted = new List<(string kind, string value)>();
        foreach (var raw in cmd.Values.Select(v => v?.Trim()).Where(v => !string.IsNullOrEmpty(v)).Distinct(StringComparer.OrdinalIgnoreCase))
        {
            var kind = raw!.Contains('@') ? SuppressionKind.Email : SuppressionKind.Domain;
            var v = SuppressionEntry.Normalize(kind, raw);
            if (v.Length is > 0 and <= 320) wanted.Add((kind, v));
        }

        var existing = (await db.Suppressions.AsNoTracking().Where(s => !s.IsDeleted).Select(s => s.Kind + "|" + s.Value).ToListAsync(ct)).ToHashSet();
        int added = 0, skipped = 0;
        foreach (var (kind, value) in wanted)
        {
            if (!existing.Add(kind + "|" + value)) { skipped++; continue; }
            db.Suppressions.Add(new SuppressionEntry(kind, value, SuppressionReason.Manual, "import", user.Id));
            added++;
        }
        await db.SaveChangesAsync(ct);
        if (added > 0) await SuppressionSupport.MarkAllProspectsAsync(db, ct);
        return Result.Success(new ImportSuppressionResult(added, skipped));
    }
}

/// <summary>
/// Suppression is checked in one place so a prospect, a campaign and a reply can never disagree about
/// whether someone may be contacted.
/// </summary>
internal static class SuppressionSupport
{
    /// <summary>Everything this workspace — and the whole platform — must not contact.</summary>
    public static async Task<HashSet<string>> LoadAsync(LeadGenDbContext db, CancellationToken ct)
    {
        var own = await db.Suppressions.AsNoTracking().Where(s => !s.IsDeleted).Select(s => s.Kind + "|" + s.Value).ToListAsync(ct);
        var global = await db.GlobalSuppressions.AsNoTracking().Select(s => s.Kind + "|" + s.Value).ToListAsync(ct);
        return own.Concat(global).ToHashSet();
    }

    public static bool IsSuppressed(HashSet<string> set, string? email, string? domain, string? phoneE164)
    {
        if (!string.IsNullOrWhiteSpace(email))
        {
            var e = email.Trim().ToLowerInvariant();
            if (set.Contains(SuppressionKind.Email + "|" + e)) return true;
            var at = e.IndexOf('@');
            if (at > 0 && set.Contains(SuppressionKind.Domain + "|" + e[(at + 1)..])) return true;
        }
        if (!string.IsNullOrWhiteSpace(domain) && set.Contains(SuppressionKind.Domain + "|" + domain.Trim().ToLowerInvariant())) return true;
        if (!string.IsNullOrWhiteSpace(phoneE164) && set.Contains(SuppressionKind.Phone + "|" + SuppressionEntry.Normalize(SuppressionKind.Phone, phoneE164))) return true;
        return false;
    }

    public static async Task AddAsync(LeadGenDbContext db, string kind, string value, string reason, string source, Guid? userId, bool alsoGlobal, CancellationToken ct)
    {
        var v = SuppressionEntry.Normalize(kind, value);
        if (v.Length == 0) return;
        if (!await db.Suppressions.AnyAsync(s => s.Kind == kind && s.Value == v && !s.IsDeleted, ct))
            db.Suppressions.Add(new SuppressionEntry(kind, v, reason, source, userId));
        if (alsoGlobal && !await db.GlobalSuppressions.AnyAsync(s => s.Kind == kind && s.Value == v, ct))
            db.GlobalSuppressions.Add(new GlobalSuppression(kind, v, reason));
    }

    /// <summary>Marks matching prospects do-not-contact so they drop out of every list and campaign.</summary>
    public static async Task MarkProspectsAsync(LeadGenDbContext db, string kind, string value, CancellationToken ct)
    {
        var q = db.Prospects.Where(p => !p.IsDeleted && p.Status != ProspectStatus.DoNotContact);
        q = kind switch
        {
            SuppressionKind.Email  => q.Where(p => p.Email != null && p.Email.ToLower() == value),
            SuppressionKind.Domain => q.Where(p => p.Domain == value || (p.Email != null && p.Email.ToLower().EndsWith("@" + value))),
            _                      => q.Where(p => p.PhoneE164 != null),
        };
        if (kind == SuppressionKind.Phone)
        {
            var list = await q.ToListAsync(ct);
            foreach (var p in list.Where(p => SuppressionEntry.Normalize(SuppressionKind.Phone, p.PhoneE164!) == value)) p.SetStatus(ProspectStatus.DoNotContact);
        }
        else foreach (var p in await q.ToListAsync(ct)) p.SetStatus(ProspectStatus.DoNotContact);
        await db.SaveChangesAsync(ct);
    }

    public static async Task MarkAllProspectsAsync(LeadGenDbContext db, CancellationToken ct)
    {
        var set = await LoadAsync(db, ct);
        var open = await db.Prospects.Where(p => !p.IsDeleted && p.Status != ProspectStatus.DoNotContact && (p.Email != null || p.Domain != null))
            .Select(p => new { p.Id, p.Email, p.Domain, p.PhoneE164 }).ToListAsync(ct);
        var ids = open.Where(p => IsSuppressed(set, p.Email, p.Domain, p.PhoneE164)).Select(p => p.Id).ToList();
        if (ids.Count == 0) return;
        foreach (var p in await db.Prospects.Where(p => ids.Contains(p.Id)).ToListAsync(ct)) p.SetStatus(ProspectStatus.DoNotContact);
        await db.SaveChangesAsync(ct);
    }
}
