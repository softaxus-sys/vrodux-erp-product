using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Identity.Application.TenantSettings.Queries;

/// <summary>
/// The signed-in tenant's own object-storage usage against their plan's budget — the tenant-facing
/// counterpart to the super-admin-wide <c>GetStorageUsageQuery</c>. Drives the in-app "approaching
/// your storage limit" banner.
/// </summary>
public sealed record TenantStorageStatusDto(
    string Plan, long UsedBytes, long BudgetBytes, double PercentUsed, bool NearBudget, bool Unlimited);

public sealed record GetTenantStorageUsageQuery : IQuery<TenantStorageStatusDto>;
