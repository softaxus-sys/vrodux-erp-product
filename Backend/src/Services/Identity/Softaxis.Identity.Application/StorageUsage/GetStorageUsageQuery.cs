using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Identity.Application.StorageUsage;

/// <summary>
/// Per-tenant breakdown of the shared object-storage bucket, for the super-admin console. Only
/// counts bytes actually living in the bucket (ObjectKey set) — a row still stored the legacy way
/// (predating object storage, or object storage never configured) isn't using the bucket budget at
/// all, so it's excluded rather than double-counted. Best-effort/estimate, not an audit: a bucket
/// delete that failed silently (DeleteAsync is best-effort everywhere it's called) would leave an
/// orphaned object the DB no longer knows about, which this can't see either.
/// </summary>
public sealed record TenantStorageUsageDto(
    Guid TenantId, string TenantName, string Plan,
    long HrBytes, long CrmBytes, long SupportBytes, long RealEstateBytes)
{
    public long TotalBytes => HrBytes + CrmBytes + SupportBytes + RealEstateBytes;
}

public sealed record StorageUsageDto(
    long BudgetBytes, long TotalBytes, IReadOnlyList<TenantStorageUsageDto> Tenants);

public sealed record GetStorageUsageQuery : IQuery<StorageUsageDto>;
