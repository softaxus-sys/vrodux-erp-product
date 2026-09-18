using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.RealEstate.Application.WebsiteIntegrations;
using Softaxis.RealEstate.Domain.Entities;
using Softaxis.RealEstate.Infrastructure.Persistence;

namespace Softaxis.RealEstate.Infrastructure.Handlers.WebsiteIntegrations;

internal static class WebsiteIntegrationScope
{
    public static readonly Error NoTenant =
        Error.Custom("WebsiteIntegration.NoTenant", "Website integration is managed from within a workspace.");

    public static readonly Error NotFound =
        Error.Custom("WebsiteIntegration.NotFound", "No website is connected yet.");

    /// <summary>
    /// The caller's own workspace, explicitly. The global filter is bypassed for super admins, and
    /// a key belongs to exactly one workspace — so these handlers never lean on it.
    /// </summary>
    public static Guid? CurrentTenant() => TenantAmbient.TenantId;

    public static IQueryable<WebsiteIntegration> For(RealEstateDbContext db, Guid tenantId) =>
        db.WebsiteIntegrations.IgnoreQueryFilters()
            .Where(w => EF.Property<Guid?>(w, RealEstateDbContext.OwnerTenant) == tenantId);

    public static IQueryable<Property> PublishedFor(RealEstateDbContext db, Guid tenantId) =>
        db.Properties.IgnoreQueryFilters()
            .Where(p => p.ListOnWebsite && !p.IsDeleted
                        && EF.Property<Guid?>(p, RealEstateDbContext.OwnerTenant) == tenantId);

    public static async Task<WebsiteIntegrationDto> ToDtoAsync(
        RealEstateDbContext db, WebsiteIntegration w, Guid tenantId, CancellationToken ct) =>
        new(w.Id, w.Name, w.WebsiteOrigin, w.KeyHint, w.IsActive, w.CreatedAt, w.KeyGeneratedAt,
            w.LastUsedAt, await PublishedFor(db, tenantId).CountAsync(ct));
}

internal sealed class GetWebsiteIntegrationHandler(RealEstateDbContext db)
    : IQueryHandler<GetWebsiteIntegrationQuery, WebsiteIntegrationDto?>
{
    public async Task<Result<WebsiteIntegrationDto?>> Handle(GetWebsiteIntegrationQuery query, CancellationToken ct)
    {
        if (WebsiteIntegrationScope.CurrentTenant() is not { } tenantId)
            return Result.Failure<WebsiteIntegrationDto?>(WebsiteIntegrationScope.NoTenant);

        var w = await WebsiteIntegrationScope.For(db, tenantId).AsNoTracking().FirstOrDefaultAsync(ct);
        return Result.Success<WebsiteIntegrationDto?>(
            w is null ? null : await WebsiteIntegrationScope.ToDtoAsync(db, w, tenantId, ct));
    }
}

internal sealed class GetPublishedPropertiesHandler(RealEstateDbContext db)
    : IQueryHandler<GetPublishedPropertiesQuery, IReadOnlyList<PublishedPropertyDto>>
{
    public async Task<Result<IReadOnlyList<PublishedPropertyDto>>> Handle(
        GetPublishedPropertiesQuery query, CancellationToken ct)
    {
        if (WebsiteIntegrationScope.CurrentTenant() is not { } tenantId)
            return Result.Failure<IReadOnlyList<PublishedPropertyDto>>(WebsiteIntegrationScope.NoTenant);

        var rows = await WebsiteIntegrationScope.PublishedFor(db, tenantId).AsNoTracking()
            .OrderByDescending(p => p.PublishedAt)
            .Select(p => new PublishedPropertyDto(
                p.Id, p.PropertyNumber, p.Name, p.City, p.PublishedAt,
                db.PropertyImages.Count(i => i.PropertyId == p.Id && !i.IsDeleted)))
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<PublishedPropertyDto>>(rows);
    }
}

internal sealed class CreateWebsiteIntegrationHandler(RealEstateDbContext db)
    : ICommandHandler<CreateWebsiteIntegrationCommand, WebsiteApiKeyDto>
{
    public async Task<Result<WebsiteApiKeyDto>> Handle(CreateWebsiteIntegrationCommand cmd, CancellationToken ct)
    {
        if (WebsiteIntegrationScope.CurrentTenant() is not { } tenantId)
            return Result.Failure<WebsiteApiKeyDto>(WebsiteIntegrationScope.NoTenant);

        if (await WebsiteIntegrationScope.For(db, tenantId).AnyAsync(ct))
            return Result.Failure<WebsiteApiKeyDto>(Error.Custom(
                "WebsiteIntegration.Duplicate",
                "A website is already connected. Change its address or regenerate its key instead."));

        var origin = WebsiteIntegration.NormaliseOrigin(cmd.WebsiteUrl)!;
        var (integration, key) = WebsiteIntegration.Create(cmd.Name, origin);

        db.WebsiteIntegrations.Add(integration);
        db.Entry(integration).Property(RealEstateDbContext.OwnerTenant).CurrentValue = tenantId;
        await db.SaveChangesAsync(ct);

        return Result.Success(new WebsiteApiKeyDto(
            await WebsiteIntegrationScope.ToDtoAsync(db, integration, tenantId, ct), key));
    }
}

internal sealed class UpdateWebsiteIntegrationHandler(RealEstateDbContext db)
    : ICommandHandler<UpdateWebsiteIntegrationCommand, WebsiteIntegrationDto>
{
    public async Task<Result<WebsiteIntegrationDto>> Handle(UpdateWebsiteIntegrationCommand cmd, CancellationToken ct)
    {
        if (WebsiteIntegrationScope.CurrentTenant() is not { } tenantId)
            return Result.Failure<WebsiteIntegrationDto>(WebsiteIntegrationScope.NoTenant);

        var w = await WebsiteIntegrationScope.For(db, tenantId).FirstOrDefaultAsync(ct);
        if (w is null) return Result.Failure<WebsiteIntegrationDto>(WebsiteIntegrationScope.NotFound);

        w.Update(cmd.Name, WebsiteIntegration.NormaliseOrigin(cmd.WebsiteUrl)!);
        await db.SaveChangesAsync(ct);
        return Result.Success(await WebsiteIntegrationScope.ToDtoAsync(db, w, tenantId, ct));
    }
}

internal sealed class RegenerateWebsiteApiKeyHandler(RealEstateDbContext db)
    : ICommandHandler<RegenerateWebsiteApiKeyCommand, WebsiteApiKeyDto>
{
    public async Task<Result<WebsiteApiKeyDto>> Handle(RegenerateWebsiteApiKeyCommand cmd, CancellationToken ct)
    {
        if (WebsiteIntegrationScope.CurrentTenant() is not { } tenantId)
            return Result.Failure<WebsiteApiKeyDto>(WebsiteIntegrationScope.NoTenant);

        var w = await WebsiteIntegrationScope.For(db, tenantId).FirstOrDefaultAsync(ct);
        if (w is null) return Result.Failure<WebsiteApiKeyDto>(WebsiteIntegrationScope.NotFound);

        var key = w.RotateKey();
        await db.SaveChangesAsync(ct);
        return Result.Success(new WebsiteApiKeyDto(await WebsiteIntegrationScope.ToDtoAsync(db, w, tenantId, ct), key));
    }
}

internal sealed class SetWebsiteIntegrationActiveHandler(RealEstateDbContext db)
    : ICommandHandler<SetWebsiteIntegrationActiveCommand, WebsiteIntegrationDto>
{
    public async Task<Result<WebsiteIntegrationDto>> Handle(SetWebsiteIntegrationActiveCommand cmd, CancellationToken ct)
    {
        if (WebsiteIntegrationScope.CurrentTenant() is not { } tenantId)
            return Result.Failure<WebsiteIntegrationDto>(WebsiteIntegrationScope.NoTenant);

        var w = await WebsiteIntegrationScope.For(db, tenantId).FirstOrDefaultAsync(ct);
        if (w is null) return Result.Failure<WebsiteIntegrationDto>(WebsiteIntegrationScope.NotFound);

        w.SetActive(cmd.IsActive);
        await db.SaveChangesAsync(ct);
        return Result.Success(await WebsiteIntegrationScope.ToDtoAsync(db, w, tenantId, ct));
    }
}

internal sealed class WithdrawAllWebsiteListingsHandler(RealEstateDbContext db)
    : ICommandHandler<WithdrawAllWebsiteListingsCommand, int>
{
    public async Task<Result<int>> Handle(WithdrawAllWebsiteListingsCommand cmd, CancellationToken ct)
    {
        if (WebsiteIntegrationScope.CurrentTenant() is not { } tenantId)
            return Result.Failure<int>(WebsiteIntegrationScope.NoTenant);

        var listed = await WebsiteIntegrationScope.PublishedFor(db, tenantId).ToListAsync(ct);
        foreach (var p in listed) p.SetWebsiteListing(false);
        await db.SaveChangesAsync(ct);
        return Result.Success(listed.Count);
    }
}

/// <summary>
/// Runs anonymously, before any tenant is known — hence IgnoreQueryFilters and the explicit
/// tenant read off the row. Unknown key, disabled integration and lapsed workspace all fail the
/// same way, so a caller learns nothing about which it hit.
/// </summary>
internal sealed class ResolveWebsiteClientHandler(RealEstateDbContext db)
    : IQueryHandler<ResolveWebsiteClientQuery, WebsiteClientDto>
{
    private static readonly Error Invalid =
        Error.Custom("WebsiteIntegration.InvalidKey", "Invalid or inactive API key.");

    private static readonly TimeSpan LastUsedGranularity = TimeSpan.FromMinutes(5);

    public async Task<Result<WebsiteClientDto>> Handle(ResolveWebsiteClientQuery query, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(query.ApiKey) || !query.ApiKey.StartsWith(WebsiteIntegration.KeyPrefix))
            return Result.Failure<WebsiteClientDto>(Invalid);

        var hash = WebsiteIntegration.Hash(query.ApiKey.Trim());

        var row = await db.WebsiteIntegrations.IgnoreQueryFilters().AsNoTracking()
            .Where(w => w.KeyHash == hash && w.IsActive)
            .Select(w => new
            {
                w.Id,
                w.WebsiteOrigin,
                w.LastUsedAt,
                TenantId = EF.Property<Guid?>(w, RealEstateDbContext.OwnerTenant),
            })
            .FirstOrDefaultAsync(ct);

        if (row?.TenantId is null) return Result.Failure<WebsiteClientDto>(Invalid);

        var tenant = await db.TenantLookups.AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == row.TenantId.Value, ct);

        // A lapsed customer's website goes quiet: that is the intended consequence of non-payment.
        if (tenant is null || tenant.Status is "Suspended" or "Expired")
            return Result.Failure<WebsiteClientDto>(Invalid);

        // Throttled write: a busy site would otherwise update this row on every request.
        var now = DateTime.UtcNow;
        if (row.LastUsedAt is null || now - row.LastUsedAt > LastUsedGranularity)
        {
            await db.WebsiteIntegrations.IgnoreQueryFilters()
                .Where(w => w.Id == row.Id)
                .ExecuteUpdateAsync(s => s.SetProperty(w => w.LastUsedAt, now), ct);
        }

        return Result.Success(new WebsiteClientDto(row.Id, row.TenantId.Value, tenant.Name, row.WebsiteOrigin));
    }
}
