using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.BuildingBlocks.Infrastructure.Storage;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Application.TenantSettings.Queries;
using Softaxis.Identity.Domain.Repositories;
using Softaxis.Identity.Infrastructure.Persistence;

namespace Softaxis.Identity.Infrastructure.Handlers.TenantSettings;

/// <summary>Self-service: the signed-in tenant's own usage of the shared object-storage bucket.
/// Reuses the same <see cref="TenantStorageQuota"/> helper the four upload handlers (HR/CRM/
/// Support/RealEstate) use to enforce the hard block, so the number shown here can never disagree
/// with what actually gets refused on the next upload.</summary>
public sealed class GetTenantStorageUsageQueryHandler(
    ITenantContext tenantContext, ITenantRepository tenantRepo, IdentityDbContext db)
    : IQueryHandler<GetTenantStorageUsageQuery, TenantStorageStatusDto>
{
    public async Task<Result<TenantStorageStatusDto>> Handle(GetTenantStorageUsageQuery query, CancellationToken ct)
    {
        if (tenantContext.TenantId is not { } tenantId)
            return Result.Failure<TenantStorageStatusDto>(Error.Custom("Tenant.NotResolved", "No tenant context on this request."));

        var tenant = await tenantRepo.GetByIdAsync(tenantId, ct);
        if (tenant is null)
            return Result.Failure<TenantStorageStatusDto>(Error.Custom("Tenant.NotFound", "Tenant not found."));

        var status = await TenantStorageQuota.GetUsageAsync(db.Database, tenantId, ct);
        var unlimited = status.BudgetBytes == long.MaxValue;

        return Result.Success(new TenantStorageStatusDto(
            tenant.Plan.ToString(), status.UsedBytes, unlimited ? 0 : status.BudgetBytes,
            status.PercentUsed, status.NearBudget, unlimited));
    }
}
