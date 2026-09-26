using Microsoft.EntityFrameworkCore;
using Softaxis.Seo.Infrastructure.Persistence;

namespace Softaxis.Seo.Infrastructure.Notifications;

/// <summary>
/// Users in a tenant holding "seo.fixes.view", resolved via a cross-schema raw SQL read of
/// Identity's tables — same pattern used throughout this codebase (CRM's CRM Manager lookup, Real
/// Estate's rent-alert CC list). "identity" is a reserved SQL Server keyword and MUST be bracketed.
/// Permission rows are keyed by (ModuleId, Action), not a single string column.
/// </summary>
internal static class SeoNotificationRecipients
{
    private sealed class Row { public Guid UserId { get; set; } }

    public static Task<IReadOnlyList<Guid>> GetAsync(SeoDbContext db, Guid tenantId, CancellationToken ct) =>
        GetAsync(db, tenantId, "seo.fixes", "view", ct);

    public static async Task<IReadOnlyList<Guid>> GetAsync(SeoDbContext db, Guid tenantId, string moduleId, string action, CancellationToken ct)
    {
        try
        {
            var rows = await db.Database.SqlQuery<Row>($"""
                SELECT DISTINCT u.Id AS UserId
                FROM [identity].[users] u
                JOIN [identity].[user_roles] ur       ON ur.UserId = u.Id
                JOIN [identity].[roles] r             ON r.Id = ur.RoleId
                JOIN [identity].[role_permissions] rp ON rp.RoleId = r.Id
                JOIN [identity].[permissions] p       ON p.Id = rp.PermissionId
                WHERE u.IsDeleted = 0 AND r.IsDeleted = 0
                  AND u.TenantId = {tenantId} AND r.TenantId = {tenantId}
                  AND p.ModuleId = {moduleId} AND p.Action = {action}
                """).ToListAsync(ct);
            return rows.Select(r => r.UserId).ToList();
        }
        catch
        {
            // A failed recipient lookup must never fail the scan itself.
            return [];
        }
    }
}
