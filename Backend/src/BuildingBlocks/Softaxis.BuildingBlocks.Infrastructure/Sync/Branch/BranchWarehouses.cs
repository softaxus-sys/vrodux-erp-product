using Microsoft.Data.SqlClient;

namespace Softaxis.BuildingBlocks.Infrastructure.Sync.Branch;

/// <summary>
/// The warehouses that belong to one branch (<c>inventory.warehouses.BranchId</c>). Stock rows are keyed by
/// warehouse, so this is how both sides decide which stock rows are a branch's own.
/// </summary>
public static class BranchWarehouses
{
    public static async Task<HashSet<Guid>> LoadAsync(string? connectionString, Guid tenantId, Guid branchId, CancellationToken ct)
    {
        var ids = new HashSet<Guid>();
        if (string.IsNullOrWhiteSpace(connectionString)) return ids;

        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT [Id] FROM [inventory].[warehouses] WHERE [TenantId] = @t AND [BranchId] = @b AND [IsDeleted] = 0";
        cmd.Parameters.Add(new SqlParameter("@t", tenantId));
        cmd.Parameters.Add(new SqlParameter("@b", branchId));
        await using var r = await cmd.ExecuteReaderAsync(ct);
        while (await r.ReadAsync(ct)) ids.Add(r.GetGuid(0));
        return ids;
    }
}
