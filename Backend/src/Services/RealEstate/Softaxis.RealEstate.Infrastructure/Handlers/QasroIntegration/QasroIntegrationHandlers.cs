using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.RealEstate.Application.Abstractions;
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
/// Starts the handshake. Creates (or reuses) the integration row in "connecting" state — no key
/// yet, that's only generated once Qasro confirms approval in the callback below — and builds the
/// URL to redirect the tenant admin's browser to. Re-clicking "Connect" after a failed/abandoned
/// attempt just reuses the same row rather than creating a second one, which the tenant-unique
/// index would reject anyway.
/// </summary>
internal sealed class StartQasroOAuthHandler(RealEstateDbContext db, IQasroClient qasro, ISecretProtector protector)
    : ICommandHandler<StartQasroOAuthCommand, QasroOAuthUrlDto>
{
    public async Task<Result<QasroOAuthUrlDto>> Handle(StartQasroOAuthCommand cmd, CancellationToken ct)
    {
        if (QasroIntegrationScope.CurrentTenant() is not { } tenantId)
            return Result.Failure<QasroOAuthUrlDto>(QasroIntegrationScope.NoTenant);

        var tenant = await db.TenantLookups.AsNoTracking().FirstOrDefaultAsync(t => t.Id == tenantId, ct);
        if (tenant is null)
            return Result.Failure<QasroOAuthUrlDto>(Error.Custom("QasroIntegration.TenantNotFound", "Workspace not found."));

        var integration = await QasroIntegrationScope.For(db, tenantId).FirstOrDefaultAsync(ct);
        if (integration is null)
        {
            integration = QasroIntegration.CreateConnecting();
            db.QasroIntegrations.Add(integration);
            db.Entry(integration).Property(RealEstateDbContext.OwnerTenant).CurrentValue = tenantId;
            await db.SaveChangesAsync(ct);
        }

        var state = Uri.EscapeDataString(protector.Protect(integration.Id.ToString())!);
        var url = qasro.BuildAuthorizeUrl(cmd.RedirectUri, state, tenant.Name);
        return Result.Success(new QasroOAuthUrlDto(url));
    }
}

/// <summary>
/// Runs anonymously, before any tenant is known — hence IgnoreQueryFilters and the explicit
/// tenant read off the row, exactly like MetaOAuthCallbackHandler and the SEO module's
/// GoogleOAuthCallbackHandler. Only reaches here after Qasro's OWN login/signup and
/// approval-gate screens — this handler's job is just to turn a successful redirect into a
/// working local pull key, not to authenticate or approve anything itself.
/// </summary>
internal sealed class QasroOAuthCallbackHandler(RealEstateDbContext db, IQasroClient qasro, ISecretProtector protector)
    : ICommandHandler<QasroOAuthCallbackCommand>
{
    public async Task<Result> Handle(QasroOAuthCallbackCommand cmd, CancellationToken ct)
    {
        if (!Guid.TryParse(protector.Unprotect(cmd.State), out var integrationId))
            return Result.Failure(Error.Custom("QasroIntegration.InvalidState", "Invalid OAuth state."));

        var integration = await db.QasroIntegrations.IgnoreQueryFilters()
            .FirstOrDefaultAsync(q => q.Id == integrationId, ct);
        if (integration is null)
            return Result.Failure(Error.NotFoundById("QasroIntegration", integrationId));

        string agencyId;
        try
        {
            agencyId = await qasro.ExchangeCodeAsync(cmd.Code, cmd.RedirectUri, ct);
        }
        catch (QasroNotApprovedException ex)
        {
            integration.MarkError(ex.Message);
            await db.SaveChangesAsync(ct);
            return Result.Failure(Error.Custom("QasroIntegration.NotApproved", ex.Message));
        }
        catch (Exception ex)
        {
            integration.MarkError(ex.Message);
            await db.SaveChangesAsync(ct);
            return Result.Failure(Error.Custom("QasroIntegration.ConnectFailed", "Could not complete the Qasro connection."));
        }

        // Only generated now — approval is confirmed, so this is the first moment a key is worth
        // having. Registering it is the one thing this side still pushes to Qasro, and only because
        // the handshake above already succeeded.
        var apiKey = integration.RotateKey();
        try
        {
            await qasro.RegisterPullKeyAsync(agencyId, apiKey, "/api/real-estate/website", ct);
        }
        catch (Exception ex)
        {
            integration.MarkError(ex.Message);
            await db.SaveChangesAsync(ct);
            return Result.Failure(Error.Custom("QasroIntegration.ConnectFailed", "Qasro approved the connection but the listings key could not be registered."));
        }

        integration.MarkConnected(agencyId);
        await db.SaveChangesAsync(ct);
        return Result.Success();
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
