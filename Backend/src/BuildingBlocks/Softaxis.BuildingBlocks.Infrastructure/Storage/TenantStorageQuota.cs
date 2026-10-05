using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Softaxis.BuildingBlocks.Domain.Multitenancy;

namespace Softaxis.BuildingBlocks.Infrastructure.Storage;

/// <summary>One tenant's current bucket usage against their plan's budget, for an upload about to
/// happen. <see cref="Allowed"/> is the hard-block check; <see cref="NearBudget"/> is the
/// warn-at-90% signal — both computed from the same read so they can never disagree.</summary>
public sealed record StorageQuotaStatus(long UsedBytes, long BudgetBytes, long IncomingBytes)
{
    public long ProjectedBytes => UsedBytes + IncomingBytes;

    /// <summary>True for an unlimited plan (BudgetBytes = long.MaxValue) or when the upload fits.</summary>
    public bool Allowed => BudgetBytes == long.MaxValue || ProjectedBytes <= BudgetBytes;

    /// <summary>Already at/over 90% BEFORE this upload — used to decide whether to warn, independent
    /// of whether this particular upload is itself allowed.</summary>
    public bool NearBudget => BudgetBytes != long.MaxValue && BudgetBytes > 0 && (double)UsedBytes / BudgetBytes >= 0.9;

    public double PercentUsed =>
        BudgetBytes == long.MaxValue || BudgetBytes <= 0 ? 0 : Math.Min(100, (double)UsedBytes / BudgetBytes * 100);

    /// <summary>For error/warning messages — "Your plan includes {BudgetGb}GB".</summary>
    public double UsedGb   => Math.Round(UsedBytes / 1024.0 / 1024.0 / 1024.0, 2);
    public double BudgetGb => BudgetBytes == long.MaxValue ? -1 : Math.Round(BudgetBytes / 1024.0 / 1024.0 / 1024.0, 2);
}

/// <summary>
/// Enforces the per-tenant object-storage budget (<see cref="PlanStorageLimits"/>) at upload time,
/// shared by the services that write to the bucket (HR, CRM, Support, RealEstate, Restaurant). One raw
/// cross-schema query per check — all five services (Identity + these four) point at the same
/// physical SoftaxisErpDb under their own schema, which is what makes a single-tenant usage sum
/// cheap enough to run on every upload rather than needing a cached counter.
///
/// <para>`identity` is a reserved SQL Server keyword and MUST stay bracketed, or this fails with
/// "Incorrect syntax near the keyword 'identity'" (the same gotcha flagged throughout this codebase
/// wherever a cross-schema query touches tenants).</para>
///
/// <para>RealEstate is the one service whose tenant shadow column is NOT called "TenantId" — see
/// <c>RealEstateDbContext.OwnerTenant = "OwnerTenantId"</c>. Every other service here uses the
/// default name. Confirmed live against production: the wrong column name here produces a
/// misleading "Incorrect syntax near..." error on EARLIER tokens (SQL Server's parser-recovery
/// cascade after a real "Invalid column name" binding error later in the statement), not a clean
/// error pointing at the actual problem — so don't trust the first reported error location blindly
/// when debugging a cross-schema query that touches RealEstate.</para>
/// </summary>
public static class TenantStorageQuota
{
    public static async Task<StorageQuotaStatus> CheckAsync(
        DatabaseFacade db, Guid tenantId, long incomingBytes, CancellationToken ct)
    {
        var rows = await db.SqlQueryRaw<UsageRow>("""
            SELECT
                (
                    (SELECT ISNULL(SUM(SizeBytes),0) FROM [hr].[employee_documents]
                     WHERE TenantId = {0} AND ObjectKey IS NOT NULL AND IsDeleted = 0) +
                    (SELECT ISNULL(SUM(SizeBytes),0) FROM [crm].[crm_documents]
                     WHERE TenantId = {0} AND ObjectKey IS NOT NULL AND IsDeleted = 0) +
                    (SELECT ISNULL(SUM(sa.SizeBytes),0) FROM [support].[support_ticket_attachments] sa
                     JOIN [support].[support_tickets] st ON st.Id = sa.TicketId
                     WHERE st.RequestingTenantId = {0} AND sa.ObjectKey IS NOT NULL) +
                    (SELECT ISNULL(SUM(SizeBytes),0) FROM [real_estate].[PropertyImages]
                     WHERE OwnerTenantId = {0} AND ObjectKey IS NOT NULL AND IsDeleted = 0) +
                    (SELECT ISNULL(SUM(SizeBytes),0) FROM [restaurant].[MenuItemImages]
                     WHERE TenantId = {0} AND ObjectKey IS NOT NULL AND IsDeleted = 0)
                ) AS UsedBytes,
                (SELECT [Plan] FROM [identity].[tenants] WHERE [Id] = {0}) AS [Plan]
            """, tenantId).ToListAsync(ct);

        var row = rows.FirstOrDefault();
        var budgetBytes = PlanStorageLimits.BudgetBytesFor(row?.Plan);
        return new StorageQuotaStatus(row?.UsedBytes ?? 0, budgetBytes, incomingBytes);
    }

    /// <summary>Same usage read as <see cref="CheckAsync"/>, for a tenant-facing "how much am I
    /// using" display rather than a pending upload — IncomingBytes is 0.</summary>
    public static Task<StorageQuotaStatus> GetUsageAsync(DatabaseFacade db, Guid tenantId, CancellationToken ct) =>
        CheckAsync(db, tenantId, incomingBytes: 0, ct);

    /// <summary>Shared wording for the hard-block error, so the four upload handlers can't drift
    /// on how this reads. <paramref name="fileName"/> may be null (RealEstate uploads several
    /// photos per call and the handler decides per-photo naming on its own).</summary>
    public static string QuotaErrorMessage(StorageQuotaStatus status, string? fileName) =>
        $"{(fileName is null ? "This upload" : $"'{fileName}'")} would put you over your plan's " +
        $"{status.BudgetGb:0.##}GB storage limit (currently using {status.UsedGb:0.##}GB). " +
        "Delete something you no longer need, or upgrade your plan in Settings → Billing.";

    private sealed class UsageRow
    {
        public long    UsedBytes { get; set; }
        public string? Plan      { get; set; }
    }
}
