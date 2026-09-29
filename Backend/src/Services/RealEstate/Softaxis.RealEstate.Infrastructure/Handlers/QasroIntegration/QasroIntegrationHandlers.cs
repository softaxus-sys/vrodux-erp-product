using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.RealEstate.Application.QasroIntegrations;
using Softaxis.RealEstate.Domain.Entities;
using Softaxis.RealEstate.Infrastructure.Persistence;
using Softaxis.RealEstate.Infrastructure.Qasro;

namespace Softaxis.RealEstate.Infrastructure.Handlers.QasroIntegrations;

internal static class QasroIntegrationScope
{
    public static readonly Error NoTenant =
        Error.Custom("QasroIntegration.NoTenant", "Qasro is connected from within a workspace.");

    public static readonly Error NotConnected =
        Error.Custom("QasroIntegration.NotConnected", "Qasro is not connected yet.");

    public static Guid? CurrentTenant() => TenantAmbient.TenantId;

    public static IQueryable<QasroIntegration> For(RealEstateDbContext db, Guid tenantId) =>
        db.QasroIntegrations.IgnoreQueryFilters()
            .Where(q => EF.Property<Guid?>(q, RealEstateDbContext.OwnerTenant) == tenantId);

    public static IQueryable<Property> PublishedFor(RealEstateDbContext db, Guid tenantId) =>
        db.Properties.IgnoreQueryFilters()
            .Where(p => p.ListOnQasro && !p.IsDeleted
                        && EF.Property<Guid?>(p, RealEstateDbContext.OwnerTenant) == tenantId);

    public static async Task<QasroIntegrationDto> ToDtoAsync(
        RealEstateDbContext db, QasroIntegration q, Guid tenantId, CancellationToken ct) =>
        new(q.Id, q.QasroAgencyId, q.Status, q.LastError, q.CreatedAt, q.ConnectedAt, q.LastUsedAt,
            await PublishedFor(db, tenantId).CountAsync(ct));
}

internal sealed class GetQasroIntegrationHandler(RealEstateDbContext db)
    : IQueryHandler<GetQasroIntegrationQuery, QasroIntegrationDto?>
{
    public async Task<Result<QasroIntegrationDto?>> Handle(GetQasroIntegrationQuery query, CancellationToken ct)
    {
        if (QasroIntegrationScope.CurrentTenant() is not { } tenantId)
            return Result.Failure<QasroIntegrationDto?>(QasroIntegrationScope.NoTenant);

        var q = await QasroIntegrationScope.For(db, tenantId).AsNoTracking().FirstOrDefaultAsync(ct);
        return Result.Success<QasroIntegrationDto?>(
            q is null ? null : await QasroIntegrationScope.ToDtoAsync(db, q, tenantId, ct));
    }
}

internal sealed class GetQasroPublishedPropertiesHandler(RealEstateDbContext db)
    : IQueryHandler<GetQasroPublishedPropertiesQuery, IReadOnlyList<QasroPublishedPropertyDto>>
{
    public async Task<Result<IReadOnlyList<QasroPublishedPropertyDto>>> Handle(
        GetQasroPublishedPropertiesQuery query, CancellationToken ct)
    {
        if (QasroIntegrationScope.CurrentTenant() is not { } tenantId)
            return Result.Failure<IReadOnlyList<QasroPublishedPropertyDto>>(QasroIntegrationScope.NoTenant);

        var rows = await QasroIntegrationScope.PublishedFor(db, tenantId).AsNoTracking()
            .OrderByDescending(p => p.QasroPublishedAt)
            .Select(p => new QasroPublishedPropertyDto(
                p.Id, p.PropertyNumber, p.Name, p.City, p.QasroPublishedAt,
                db.PropertyImages.Count(i => i.PropertyId == p.Id && !i.IsDeleted)))
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<QasroPublishedPropertyDto>>(rows);
    }
}

/// <summary>
/// One click, no form. Generates a key locally, then hands it to Qasro server-to-server — the
/// tenant never sees or manages it. The row is created in "connecting" state first and only
/// committed once, so a failed link call leaves nothing half-configured to clean up; a retry
/// (calling Connect again) reuses the same row and rotates the key rather than creating a second
/// one, which the tenant-unique index would reject anyway.
/// </summary>
internal sealed class ConnectQasroHandler(RealEstateDbContext db, IQasroClient qasro)
    : ICommandHandler<ConnectQasroCommand, QasroIntegrationDto>
{
    public async Task<Result<QasroIntegrationDto>> Handle(ConnectQasroCommand cmd, CancellationToken ct)
    {
        if (QasroIntegrationScope.CurrentTenant() is not { } tenantId)
            return Result.Failure<QasroIntegrationDto>(QasroIntegrationScope.NoTenant);

        var tenant = await db.TenantLookups.AsNoTracking().FirstOrDefaultAsync(t => t.Id == tenantId, ct);
        if (tenant is null)
            return Result.Failure<QasroIntegrationDto>(Error.Custom("QasroIntegration.TenantNotFound", "Workspace not found."));

        var existing = await QasroIntegrationScope.For(db, tenantId).FirstOrDefaultAsync(ct);

        string apiKey;
        QasroIntegration integration;
        if (existing is null)
        {
            (integration, apiKey) = QasroIntegration.Create();
            db.QasroIntegrations.Add(integration);
            db.Entry(integration).Property(RealEstateDbContext.OwnerTenant).CurrentValue = tenantId;
        }
        else
        {
            integration = existing;
            apiKey = integration.RotateKey(); // re-activating (or retrying a failed connect) rotates, never reuses
        }

        await db.SaveChangesAsync(ct);

        try
        {
            var agencyId = await qasro.LinkAgencyAsync(new QasroLinkRequest(
                TenantId: tenantId,
                CompanyName: tenant.Name,
                ContactEmail: null,  // TODO: pre-fill from General Settings company profile once wired
                ContactPhone: null,
                LogoUrl: null,
                ApiKey: apiKey,
                ListingsApiBaseUrl: "/api/real-estate/website"), ct);

            integration.MarkConnected(agencyId);
        }
        catch (Exception ex)
        {
            integration.MarkError(ex.Message);
            await db.SaveChangesAsync(ct);
            return Result.Failure<QasroIntegrationDto>(Error.Custom(
                "QasroIntegration.ConnectFailed", "Could not connect to Qasro. Try again in a moment."));
        }

        await db.SaveChangesAsync(ct);
        return Result.Success(await QasroIntegrationScope.ToDtoAsync(db, integration, tenantId, ct));
    }
}

internal sealed class DisconnectQasroHandler(RealEstateDbContext db, IQasroClient qasro)
    : ICommandHandler<DisconnectQasroCommand>
{
    public async Task<Result> Handle(DisconnectQasroCommand cmd, CancellationToken ct)
    {
        if (QasroIntegrationScope.CurrentTenant() is not { } tenantId)
            return Result.Failure(QasroIntegrationScope.NoTenant);

        var q = await QasroIntegrationScope.For(db, tenantId).FirstOrDefaultAsync(ct);
        if (q is null) return Result.Failure(QasroIntegrationScope.NotConnected);

        var listed = await QasroIntegrationScope.PublishedFor(db, tenantId).ToListAsync(ct);
        foreach (var p in listed) p.SetQasroListing(false);

        q.Disconnect();
        await db.SaveChangesAsync(ct);

        // After, not before: the tenant's own withdrawal must not be blocked by Qasro being slow
        // or unreachable — see UnlinkAgencyAsync's own best-effort remarks.
        if (q.QasroAgencyId is not null)
            await qasro.UnlinkAgencyAsync(q.QasroAgencyId, ct);

        return Result.Success();
    }
}

internal sealed class WithdrawAllQasroListingsHandler(RealEstateDbContext db)
    : ICommandHandler<WithdrawAllQasroListingsCommand, int>
{
    public async Task<Result<int>> Handle(WithdrawAllQasroListingsCommand cmd, CancellationToken ct)
    {
        if (QasroIntegrationScope.CurrentTenant() is not { } tenantId)
            return Result.Failure<int>(QasroIntegrationScope.NoTenant);

        var listed = await QasroIntegrationScope.PublishedFor(db, tenantId).ToListAsync(ct);
        foreach (var p in listed) p.SetQasroListing(false);
        await db.SaveChangesAsync(ct);
        return Result.Success(listed.Count);
    }
}
