using Microsoft.Data.SqlClient;
using Softaxis.BuildingBlocks.Infrastructure.Sync;

namespace Softaxis.BuildingBlocks.Tests;

public class BranchSyncCatalogTests
{
    private static readonly string? ConnectionString = Environment.GetEnvironmentVariable("SYNC_TEST_DB");

    [Fact]
    public void Every_table_has_exactly_one_owner()
    {
        var dupes = BranchSyncCatalog.All
            .GroupBy(e => e.Table, StringComparer.OrdinalIgnoreCase)
            .Where(g => g.Count() > 1).Select(g => g.Key).ToList();
        Assert.Empty(dupes);
    }

    [Fact]
    public void Every_entry_is_in_a_classified_schema_and_has_a_reason()
    {
        foreach (var e in BranchSyncCatalog.All)
        {
            var schema = e.Table.Split('.')[0];
            Assert.Contains(schema, BranchSyncCatalog.Schemas, StringComparer.OrdinalIgnoreCase);
            Assert.False(string.IsNullOrWhiteSpace(e.Reason), e.Table + " has no reason");
        }
    }

    [Fact]
    public void Mixed_ownership_tables_are_classified()
    {
        foreach (var t in BranchSyncCatalog.MixedOwnership.Keys)
            Assert.NotNull(BranchSyncCatalog.OwnerOf(t));
    }

    [Fact]
    public void Secrets_are_never_synced()
    {
        foreach (var t in new[] { "restaurant.PlatformConnections", "restaurant.NotificationProviderConfigs", "pos.payment_gateway_configs" })
            Assert.Equal(SyncOwner.NotSynced, BranchSyncCatalog.OwnerOf(t));
    }

    /// <summary>
    /// Needs a database with the product's schema (set SYNC_TEST_DB). Fails when a table exists in a
    /// classified schema but nobody has decided who owns it - the point of the catalogue.
    /// </summary>
    [Fact]
    public async Task Every_live_table_is_classified()
    {
        if (string.IsNullOrWhiteSpace(ConnectionString)) return;

        await using var conn = new SqlConnection(ConnectionString);
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT s.name + '.' + t.name FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id WHERE s.name IN (" + string.Join(",", BranchSyncCatalog.Schemas.Select(x => "'" + x + "'")) + ")";
        var live = new List<string>();
        await using (var r = await cmd.ExecuteReaderAsync())
            while (await r.ReadAsync()) live.Add(r.GetString(0));

        var missing = live.Where(t => !t.EndsWith("__EFMigrationsHistory") && BranchSyncCatalog.OwnerOf(t) is null).OrderBy(t => t).ToList();
        Assert.True(missing.Count == 0, "Unclassified tables: " + string.Join(", ", missing));

        var phantom = BranchSyncCatalog.All.Select(e => e.Table)
            .Where(t => !live.Contains(t, StringComparer.OrdinalIgnoreCase)).ToList();
        Assert.True(phantom.Count == 0, "Catalogue lists tables that do not exist: " + string.Join(", ", phantom));
    }
}
