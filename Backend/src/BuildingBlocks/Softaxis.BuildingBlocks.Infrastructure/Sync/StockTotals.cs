using Microsoft.Data.SqlClient;
using Softaxis.BuildingBlocks.Application.Sync;

namespace Softaxis.BuildingBlocks.Infrastructure.Sync;

/// <summary>
/// Keeps <c>inventory.products.StockQuantity</c> equal to the sum of its warehouse rows when a branch server
/// pushes its warehouse stock to the cloud.
///
/// <para>
/// The product total is head office's column (it flows down), but every sale at a branch moves the branch's
/// warehouse row, so on the cloud the total would otherwise stay at the opening figure for ever. The total is
/// moved by the <b>change</b> in the row, not recomputed from all rows: a product can legitimately hold stock
/// that is not in any warehouse row, and a recompute would erase it. A change of zero (a re-sent row) moves
/// nothing, so a replayed batch cannot double count.
/// </para>
///
/// <para>
/// A branch that sold before its first pull has its own row for a (product, warehouse) the cloud already
/// holds under another id. The branch's row is then applied to the cloud's row (same natural key) instead of
/// being inserted beside it, which the unique index would refuse and which would stop the branch syncing.
/// </para>
/// </summary>
internal static class StockTotals
{
    public static async Task<SyncRowDto> ApplyAsync(
        SqlConnection conn, SqlTransaction tx, SyncTable table, SyncRowDto row, Guid tenantId, CancellationToken ct)
    {
        if (row.Data is null) return row;
        if (!TryGuid(row.Data, "ProductId", out var productId) || !TryGuid(row.Data, "WarehouseId", out var warehouseId))
            return row;
        var newQty = row.Data.TryGetValue("Quantity", out var q) ? ToDecimal(q) : 0m;

        // The row that already covers this product and warehouse, if any (it may carry a different id).
        Guid? existingId = null;
        decimal oldQty = 0m;
        await using (var read = conn.CreateCommand())
        {
            read.Transaction = tx;
            read.CommandText = $"SELECT TOP 1 [Id], [Quantity] FROM {table.Qualified} WHERE [ProductId] = @p AND [WarehouseId] = @w";
            read.Parameters.Add(new SqlParameter("@p", productId));
            read.Parameters.Add(new SqlParameter("@w", warehouseId));
            await using var r = await read.ExecuteReaderAsync(ct);
            if (await r.ReadAsync(ct)) { existingId = r.GetGuid(0); oldQty = r.GetDecimal(1); }
        }

        var delta = newQty - oldQty;
        if (delta != 0m)
        {
            await using var upd = conn.CreateCommand();
            upd.Transaction = tx;
            upd.CommandText = "UPDATE [inventory].[products] SET [StockQuantity] = [StockQuantity] + @d WHERE [Id] = @p AND [TenantId] = @t";
            upd.Parameters.Add(new SqlParameter("@d", delta));
            upd.Parameters.Add(new SqlParameter("@p", productId));
            upd.Parameters.Add(new SqlParameter("@t", tenantId));
            await upd.ExecuteNonQueryAsync(ct);
        }

        // Point the upsert at the existing row so it updates rather than inserts a second one.
        if (existingId is Guid id && (row.Key.Count != 1 || !Equals(row.Key[0]?.ToString(), id.ToString())))
        {
            var data = row.Data.ToDictionary(kv => kv.Key, kv => kv.Value);
            data["Id"] = id;
            return row with { Key = [id], Data = data };
        }
        return row;
    }

    /// <summary>Values arrive as JSON elements when a row comes over the wire, and as plain numbers when read locally.</summary>
    private static decimal ToDecimal(object? v) => v switch
    {
        null => 0m,
        System.Text.Json.JsonElement { ValueKind: System.Text.Json.JsonValueKind.Number } e => e.GetDecimal(),
        System.Text.Json.JsonElement { ValueKind: System.Text.Json.JsonValueKind.String } e
            => decimal.Parse(e.GetString()!, System.Globalization.CultureInfo.InvariantCulture),
        System.Text.Json.JsonElement => 0m,
        string s => decimal.Parse(s, System.Globalization.CultureInfo.InvariantCulture),
        _ => Convert.ToDecimal(v, System.Globalization.CultureInfo.InvariantCulture),
    };

    private static bool TryGuid(IReadOnlyDictionary<string, object?> data, string name, out Guid g)
    {
        g = default;
        return data.TryGetValue(name, out var v) && v is not null && Guid.TryParse(v.ToString(), out g);
    }
}
