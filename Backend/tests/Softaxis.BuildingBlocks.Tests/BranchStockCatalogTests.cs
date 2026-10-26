using Softaxis.BuildingBlocks.Infrastructure.Sync;

namespace Softaxis.BuildingBlocks.Tests;

public class BranchStockCatalogTests
{
    private static SyncOwner OwnerOf(string table) =>
        BranchSyncCatalog.All.Single(e => e.Table.Equals(table, StringComparison.OrdinalIgnoreCase)).Owner;

    [Fact]
    public void Branch_stock_is_owned_by_the_branch_so_it_flows_up()
        => Assert.Equal(SyncOwner.Branch, OwnerOf("pos.branch_stock"));

    [Fact]
    public void The_branch_ledger_of_stock_movements_is_owned_by_the_branch()
        => Assert.Equal(SyncOwner.Branch, OwnerOf("pos.stock_movements"));

    [Fact]
    public void Products_stay_head_office_owned()
        => Assert.Equal(SyncOwner.Cloud, OwnerOf("pos.products"));
}
