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

    [Fact]
    public void The_inventory_catalogue_flows_down_and_the_branch_warehouse_stock_flows_up()
    {
        foreach (var t in new[] { "inventory.products", "inventory.product_categories", "inventory.brands", "inventory.units_of_measure", "inventory.warehouses", "inventory.product_templates" })
            Assert.Equal(SyncOwner.Cloud, OwnerOf(t));
        foreach (var t in new[] { "inventory.product_stock", "inventory.stock_movements" })
            Assert.Equal(SyncOwner.Branch, OwnerOf(t));
    }

    [Fact]
    public void Stock_rows_are_owned_by_warehouse_and_only_product_stock_is_sent_down_as_an_opening_balance()
    {
        Assert.Equal("WarehouseId", BranchSyncCatalog.WarehouseOwned["inventory.product_stock"]);
        Assert.Equal("WarehouseId", BranchSyncCatalog.WarehouseOwned["inventory.stock_movements"]);
        Assert.True(BranchSyncCatalog.IsOpeningBalance("inventory.product_stock"));
        Assert.False(BranchSyncCatalog.IsOpeningBalance("inventory.stock_movements"));
        Assert.Equal(new[] { "ProductId", "WarehouseId" }, BranchSyncCatalog.NaturalKeyOf("inventory.product_stock"));
    }

    [Fact]
    public void Every_warehouse_owned_table_is_branch_owned_so_head_office_rows_cannot_be_overwritten_from_a_branch()
    {
        foreach (var t in BranchSyncCatalog.WarehouseOwned.Keys)
            Assert.Equal(SyncOwner.Branch, OwnerOf(t));
    }

    [Fact]
    public void Things_a_branch_must_never_receive_stay_unsynced()
    {
        foreach (var t in new[] { "inventory.product_images", "inventory.catalogue_moves", "inventory.stock_transfers", "inventory.product_batches" })
            Assert.Equal(SyncOwner.NotSynced, OwnerOf(t));
    }
}
