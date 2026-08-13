using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Application.DTOs;
using Softaxis.Identity.Domain.Entities;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.TenantsAdmin.Commands.RecycleBin;

// ─────────────────────────────────────────────────────────────────────────────
// List
// ─────────────────────────────────────────────────────────────────────────────

/// <summary>
/// Soft-deleted tenants — the super-admin recycle bin. Deleting a tenant only sets
/// <c>IsDeleted</c>, so without this they were invisible with no way to restore or purge them.
/// </summary>
public sealed record GetDeletedTenantsQuery : IQuery<IReadOnlyList<TenantDto>>;

public sealed class GetDeletedTenantsQueryHandler(ITenantRepository tenantRepo)
    : IQueryHandler<GetDeletedTenantsQuery, IReadOnlyList<TenantDto>>
{
    public async Task<Result<IReadOnlyList<TenantDto>>> Handle(GetDeletedTenantsQuery query, CancellationToken ct)
    {
        var tenants = await tenantRepo.GetDeletedAsync(ct);
        IReadOnlyList<TenantDto> dtos = tenants.Select(TenantMappings.ToDto).ToList();
        return Result.Success(dtos);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Restore
// ─────────────────────────────────────────────────────────────────────────────

/// <summary>Bring a soft-deleted tenant back. All of its data is still there, just hidden.</summary>
public sealed record RestoreTenantCommand(Guid Id) : ICommand;

public sealed class RestoreTenantCommandHandler(
    ITenantRepository        tenantRepo,
    ISubscriptionAccessCache accessCache,
    IUnitOfWork              uow)
    : ICommandHandler<RestoreTenantCommand>
{
    public async Task<Result> Handle(RestoreTenantCommand cmd, CancellationToken ct)
    {
        var tenant = await tenantRepo.GetByIdIncludingDeletedAsync(cmd.Id, ct);
        if (tenant is null)
            return Result.Failure(Error.NotFoundById(nameof(Tenant), cmd.Id));

        if (!tenant.IsDeleted)
            return Result.Failure(Error.Custom("Tenant.NotDeleted", "That tenant is not in the recycle bin."));

        tenant.IsDeleted = false;
        tenant.DeletedAt = null;
        tenant.DeletedBy = null;
        tenant.UpdatedAt = DateTime.UtcNow;

        await uow.SaveChangesAsync(ct);

        // Its users can log in again immediately; drop any cached access decision.
        accessCache.Invalidate(tenant.Id);

        return Result.Success();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Permanent delete
// ─────────────────────────────────────────────────────────────────────────────

/// <summary>
/// Irreversibly delete a soft-deleted tenant.
/// <para>
/// Deliberately only reachable for a tenant already in the recycle bin, so a purge is always a
/// second, explicit decision rather than something a stray click can do.
/// </para>
/// </summary>
public sealed record PurgeTenantCommand(Guid Id) : ICommand;

public sealed class PurgeTenantCommandHandler(
    ITenantRepository        tenantRepo,
    ISubscriptionAccessCache accessCache)
    : ICommandHandler<PurgeTenantCommand>
{
    public async Task<Result> Handle(PurgeTenantCommand cmd, CancellationToken ct)
    {
        var tenant = await tenantRepo.GetByIdIncludingDeletedAsync(cmd.Id, ct);
        if (tenant is null)
            return Result.Failure(Error.NotFoundById(nameof(Tenant), cmd.Id));

        // Guard: purging is only ever a follow-up to a soft delete. A live tenant must be deleted
        // first, which makes accidental permanent loss take two deliberate actions.
        if (!tenant.IsDeleted)
            return Result.Failure(Error.Custom(
                "Tenant.NotDeleted",
                "Delete the tenant first — permanent deletion is only available from the recycle bin."));

        // Commits on its own (raw SQL, no change tracking) — no SaveChanges to follow.
        await tenantRepo.HardDeleteAsync(tenant, ct);

        // The tenant is gone; drop any cached access decision so nothing keeps answering for it.
        accessCache.Invalidate(tenant.Id);

        return Result.Success();
    }
}
