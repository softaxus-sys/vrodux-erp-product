using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.Notifications;

namespace Softaxis.BuildingBlocks.Infrastructure.Notifications;

/// <summary>
/// Cross-schema read of Identity's role/permission tables. Every service's connection string points
/// at the same physical database under a different schema, so this is one join rather than an HTTP
/// call between services — the same approach the CRM lead alerts and Real Estate rent CC list use.
/// </summary>
public sealed class NotificationRecipientResolver(
    NotificationsDbContext db, ILogger<NotificationRecipientResolver> logger) : INotificationRecipients
{
    /// <summary>Keeps a mis-scoped query from turning one approval into a workspace-wide broadcast.</summary>
    private const int MaxRecipients = 50;

    private sealed class Row { public Guid UserId { get; set; } }

    public async Task<IReadOnlyList<Guid>> WithPermissionAsync(Guid tenantId, string permissionKey, CancellationToken ct = default)
    {
        try
        {
            // A permission key is "<module>.<action>" and the tables store those halves separately.
            var lastDot = permissionKey.LastIndexOf('.');
            if (lastDot <= 0) return [];
            var module = permissionKey[..lastDot];
            var action = permissionKey[(lastDot + 1)..];

            // "identity" is a RESERVED SQL Server keyword and must be bracketed, or this fails at
            // runtime with "Incorrect syntax near the keyword 'identity'".
            var rows = await db.Database.SqlQuery<Row>($"""
                SELECT DISTINCT u.Id AS UserId
                FROM [identity].[users] u
                JOIN [identity].[user_roles] ur       ON ur.UserId = u.Id
                JOIN [identity].[role_permissions] rp ON rp.RoleId = ur.RoleId
                JOIN [identity].[permissions] p       ON p.Id = rp.PermissionId
                WHERE u.IsDeleted = 0
                  AND u.TenantId  = {tenantId}
                  AND p.ModuleId  = {module}
                  AND p.Action    = {action}
                """).ToListAsync(ct);

            return rows.Select(r => r.UserId).Distinct().Take(MaxRecipients).ToList();
        }
        catch (Exception ex)
        {
            // An unresolvable recipient list must not fail the approval that triggered it.
            logger.LogWarning(ex, "Could not resolve notification recipients for {Permission}.", permissionKey);
            return [];
        }
    }
}
