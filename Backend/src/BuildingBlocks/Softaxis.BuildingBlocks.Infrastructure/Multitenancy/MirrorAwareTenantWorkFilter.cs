using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.Multitenancy;

namespace Softaxis.BuildingBlocks.Infrastructure.Multitenancy;

/// <summary>
/// Skips workspaces that are read-only cloud mirrors of an on-premises installation.
///
/// <para>
/// Reads <c>[identity].[tenants].[IsMirror]</c> directly rather than through Identity's DbContext:
/// this lives in BuildingBlocks so every service can use it, and a project reference from each
/// service to Identity.Infrastructure would be a dependency cycle waiting to happen. Every service's
/// connection string points at the same physical database, so the cross-schema read is the same
/// pattern <c>PosSessionLedger</c> and <c>NotificationRecipientResolver</c> already use.
/// </para>
///
/// <para>
/// <c>identity</c> is a reserved SQL Server keyword and MUST stay bracketed, or the query fails with
/// "Incorrect syntax near the keyword 'identity'".
/// </para>
/// </summary>
public sealed class MirrorAwareTenantWorkFilter(
    IConfiguration                         config,
    IMemoryCache                           cache,
    ILogger<MirrorAwareTenantWorkFilter>   logger) : ITenantWorkFilter
{
    // Mirror status changes when a store is provisioned, which is a deliberate act minutes apart
    // from anything a background job does - a short cache is plenty and keeps a per-tenant loop
    // from issuing a query per workspace per run.
    private static readonly TimeSpan CacheFor = TimeSpan.FromMinutes(5);

    public async Task<bool> ShouldProcessAsync(Guid tenantId, CancellationToken ct = default)
    {
        var key = $"tenant-work-filter::{tenantId}";
        if (cache.TryGetValue(key, out bool allowed))
            return allowed;

        allowed = !await IsMirrorAsync(tenantId, ct);
        cache.Set(key, allowed, CacheFor);
        return allowed;
    }

    private async Task<bool> IsMirrorAsync(Guid tenantId, CancellationToken ct)
    {
        var cs = config.GetConnectionString("IdentityDb");
        if (string.IsNullOrWhiteSpace(cs))
            return false;   // no Identity database reachable from here: nothing is a mirror

        try
        {
            await using var conn = new SqlConnection(cs);
            await conn.OpenAsync(ct);

            await using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT [IsMirror] FROM [identity].[tenants] WHERE [Id] = @id";
            cmd.Parameters.Add(new SqlParameter("@id", tenantId));

            var result = await cmd.ExecuteScalarAsync(ct);
            return result is bool b && b;
        }
        catch (Exception ex)
        {
            // Fail OPEN, and say so. This query hits the same database the job is about to use
            // heavily, so a failure here almost certainly means the job fails next anyway. Failing
            // closed would silently stop every background job across every workspace on one bad
            // read - a far worse outcome than the narrow case this filter exists to prevent.
            logger.LogWarning(ex,
                "TenantWorkFilter: could not read mirror status for workspace {TenantId}; processing it.",
                tenantId);
            return false;
        }
    }
}
