using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;

namespace Softaxis.BuildingBlocks.Infrastructure.Sync.Branch;

/// <summary>
/// Decides what of a table a given branch may be sent. Applied on the cloud, to every page, after the
/// rows are read and before they leave - the one place that knows a branch is entitled to its own
/// workspace and its own branch only.
///
/// <para>
/// Three things, in order: (1) rows outside the branch's workspace, for tables that have no
/// <c>TenantId</c> of their own; (2) rows that belong to a different branch; (3) columns that never
/// leave the cloud. The generic change reader already filters tables that DO carry a TenantId.
/// </para>
///
/// <para>See <c>docs/branch-server-design.md</c> §6.3.</para>
/// </summary>
public sealed class BranchPullFilter(IConfiguration configuration)
{
    public async Task<IReadOnlyList<SyncRow>> ApplyAsync(
        SyncTable table, IReadOnlyList<SyncRow> rows, Guid tenantId, Guid branchId, CancellationToken ct)
    {
        IEnumerable<SyncRow> result = rows;

        if (BranchSyncCatalog.Scopes.TryGetValue(table.Name, out var rule))
        {
            switch (rule.Kind)
            {
                case BranchSyncCatalog.ScopeKind.ById:
                    result = result.Where(r => AsGuid(r.Data?.GetValueOrDefault("Id") ?? r.Key.FirstOrDefault()) == tenantId);
                    break;

                case BranchSyncCatalog.ScopeKind.ByParent:
                {
                    var parents = await LoadIdsAsync(rule.ParentTable!, tenantId, ct);
                    var fkIndex = table.KeyColumns.ToList().FindIndex(c => c.Equals(rule.ForeignKey, StringComparison.OrdinalIgnoreCase));
                    result = result.Where(r =>
                    {
                        object? fk = r.Data is not null && r.Data.TryGetValue(rule.ForeignKey!, out var v) ? v
                                   : fkIndex >= 0 && fkIndex < r.Key.Count ? r.Key[fkIndex] : null;
                        return AsGuid(fk) is { } g && parents.Contains(g);
                    });
                    break;
                }
            }
        }

        // Another branch's rows are never sent. A row with no BranchId is workspace-wide.
        result = result.Where(r =>
        {
            if (r.Data is null || !r.Data.TryGetValue("BranchId", out var b) || b is null) return true;
            return AsGuid(b) == branchId;
        });

        if (!BranchSyncCatalog.Redactions.TryGetValue(table.Name, out var hidden))
            return result.ToList();

        return result.Select(r => r.Data is null ? r : r with { Data = Redact(r.Data, hidden) }).ToList();
    }

    private static Dictionary<string, object?> Redact(IReadOnlyDictionary<string, object?> data, string[] hidden) =>
        data.Where(kv => !hidden.Contains(kv.Key, StringComparer.OrdinalIgnoreCase))
            .ToDictionary(kv => kv.Key, kv => kv.Value);

    private async Task<HashSet<Guid>> LoadIdsAsync(string qualifiedParent, Guid tenantId, CancellationToken ct)
    {
        var parts = qualifiedParent.Split('.');
        // Names come from the catalogue constants above, never from a request.
        var sql = $"SELECT [Id] FROM [{parts[0]}].[{parts[1]}] WHERE [TenantId] = @t";

        await using var conn = new SqlConnection(configuration.GetConnectionString("IdentityDb"));
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = sql;
        cmd.Parameters.Add(new SqlParameter("@t", tenantId));

        var ids = new HashSet<Guid>();
        await using var r = await cmd.ExecuteReaderAsync(ct);
        while (await r.ReadAsync(ct)) ids.Add(r.GetGuid(0));
        return ids;
    }

    private static Guid? AsGuid(object? v) => v switch
    {
        Guid g => g,
        string s when Guid.TryParse(s, out var g) => g,
        null => null,
        _ => Guid.TryParse(v.ToString(), out var g) ? g : null,
    };
}
