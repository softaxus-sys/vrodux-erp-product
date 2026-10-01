using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.BuildingBlocks.Infrastructure.Storage;
using Softaxis.Identity.Application.StorageUsage;
using Softaxis.Identity.Infrastructure.Persistence;

namespace Softaxis.Identity.Infrastructure.Handlers.StorageUsage;

/// <summary>
/// One raw cross-schema query across the four services that write to the shared object-storage
/// bucket (HR, CRM, Support, RealEstate — Finance and Identity were deliberately excluded from the
/// object-storage migration itself, so there's nothing to count there). All five services point at
/// the same physical SoftaxisErpDb under their own schema, which is what makes this a single SQL
/// statement rather than four HTTP calls fanned out and summed in memory.
///
/// <para>`identity` is a reserved SQL Server keyword and MUST stay bracketed, or this fails with
/// "Incorrect syntax near the keyword 'identity'" (same gotcha flagged throughout this codebase
/// wherever a cross-schema query touches tenants/users).</para>
/// </summary>
public sealed class GetStorageUsageQueryHandler(
    IdentityDbContext db, IOptionsSnapshot<ObjectStorageOptions> storageOptions)
    : IQueryHandler<GetStorageUsageQuery, StorageUsageDto>
{
    public async Task<Result<StorageUsageDto>> Handle(GetStorageUsageQuery query, CancellationToken ct)
    {
        var rows = await db.Database.SqlQueryRaw<TenantStorageUsageRow>("""
            SELECT t.Id AS TenantId, t.Name AS TenantName, t.Plan AS [Plan],
                   ISNULL(hr.Bytes, 0)  AS HrBytes,
                   ISNULL(crm.Bytes, 0) AS CrmBytes,
                   ISNULL(sup.Bytes, 0) AS SupportBytes,
                   ISNULL(re.Bytes, 0)  AS RealEstateBytes
            FROM [identity].[tenants] t
            LEFT JOIN (
                SELECT TenantId, SUM(SizeBytes) AS Bytes
                FROM [hr].[employee_documents]
                WHERE ObjectKey IS NOT NULL AND IsDeleted = 0 AND TenantId IS NOT NULL
                GROUP BY TenantId
            ) hr ON hr.TenantId = t.Id
            LEFT JOIN (
                SELECT TenantId, SUM(SizeBytes) AS Bytes
                FROM [crm].[crm_documents]
                WHERE ObjectKey IS NOT NULL AND IsDeleted = 0 AND TenantId IS NOT NULL
                GROUP BY TenantId
            ) crm ON crm.TenantId = t.Id
            LEFT JOIN (
                SELECT st.RequestingTenantId AS TenantId, SUM(sa.SizeBytes) AS Bytes
                FROM [support].[support_ticket_attachments] sa
                JOIN [support].[support_tickets] st ON st.Id = sa.TicketId
                WHERE sa.ObjectKey IS NOT NULL
                GROUP BY st.RequestingTenantId
            ) sup ON sup.TenantId = t.Id
            LEFT JOIN (
                SELECT TenantId, SUM(SizeBytes) AS Bytes
                FROM [real_estate].[PropertyImages]
                WHERE ObjectKey IS NOT NULL AND IsDeleted = 0 AND TenantId IS NOT NULL
                GROUP BY TenantId
            ) re ON re.TenantId = t.Id
            WHERE t.IsDeleted = 0
              AND (ISNULL(hr.Bytes,0) + ISNULL(crm.Bytes,0) + ISNULL(sup.Bytes,0) + ISNULL(re.Bytes,0)) > 0
            ORDER BY (ISNULL(hr.Bytes,0) + ISNULL(crm.Bytes,0) + ISNULL(sup.Bytes,0) + ISNULL(re.Bytes,0)) DESC
            """).ToListAsync(ct);

        var tenants = rows.Select(r => new TenantStorageUsageDto(
            r.TenantId, r.TenantName, r.Plan, r.HrBytes, r.CrmBytes, r.SupportBytes, r.RealEstateBytes)).ToList();

        var budgetBytes = (long)storageOptions.Value.BudgetGb * 1024 * 1024 * 1024;
        var totalBytes  = tenants.Sum(t => t.TotalBytes);

        return Result.Success(new StorageUsageDto(budgetBytes, totalBytes, tenants));
    }

    private sealed class TenantStorageUsageRow
    {
        public Guid   TenantId        { get; set; }
        public string TenantName      { get; set; } = string.Empty;
        public string Plan            { get; set; } = string.Empty;
        public long   HrBytes         { get; set; }
        public long   CrmBytes        { get; set; }
        public long   SupportBytes    { get; set; }
        public long   RealEstateBytes { get; set; }
    }
}
