using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.POS.Application.Abstractions;
using Softaxis.POS.Infrastructure.Persistence;

namespace Softaxis.POS.Infrastructure.Services;

/// <summary>
/// Queries both pos.products and inventory.products (same SQL Server database,
/// different schemas) so products created in either module can be sold at the
/// POS terminal.
///
/// Stock deduction also targets the correct schema so quantity is decremented
/// in the table that owns the product.
/// </summary>
public sealed class CrossSchemaProductService(POSDbContext db) : ICrossSchemaProductService
{
    // Raw-SQL row shared by both lookup and deduct helpers
    private sealed class ProductRow
    {
        public Guid    Id            { get; set; }
        public string  Name          { get; set; } = default!;
        public string? SKU           { get; set; }
        public string? Barcode       { get; set; }
        public decimal SalePrice     { get; set; }
        public decimal TaxRate       { get; set; }
        public string  Unit          { get; set; } = "pcs";
        public decimal StockQuantity { get; set; }
        public decimal ReorderLevel  { get; set; }
        public bool    IsActive      { get; set; }
        public bool    TrackInventory { get; set; }
        public string  Schema        { get; set; } = default!;   // "pos" | "inventory"
    }

    public async Task<ProductSaleView?> GetByIdForSaleAsync(Guid id, CancellationToken ct = default)
    {
        // Raw SQL bypasses EF's global tenant filter — replicate it explicitly.
        int  bypass = TenantAmbient.BypassFilter ? 1 : 0;
        Guid tenant = TenantAmbient.TenantId ?? Guid.Empty;

        var row = await db.Database
            .SqlQuery<ProductRow>($"""
                SELECT TOP 1
                    Id, Name, SKU, Barcode, SalePrice, TaxRate, Unit,
                    StockQuantity, ReorderLevel, IsActive, TrackInventory,
                    'pos' AS [Schema]
                FROM [pos].[products]
                WHERE IsDeleted = 0 AND Id = {id} AND ({bypass} = 1 OR TenantId = {tenant})

                UNION ALL

                SELECT TOP 1
                    Id, Name, SKU, Barcode, SalePrice, TaxRate, Unit,
                    StockQuantity, ReorderLevel, IsActive, TrackInventory,
                    'inventory' AS [Schema]
                FROM [inventory].[products]
                WHERE IsDeleted = 0 AND Id = {id} AND ({bypass} = 1 OR TenantId = {tenant})
                """)
            .FirstOrDefaultAsync(ct);

        if (row is null) return null;

        return new ProductSaleView(
            row.Id, row.Name, row.SKU, row.Barcode,
            row.SalePrice, row.TaxRate, row.Unit,
            row.StockQuantity, row.ReorderLevel,
            row.IsActive, row.TrackInventory, row.Schema);
    }

    public async Task DeductStockAsync(
        ProductSaleView product,
        decimal         quantity,
        string          transactionNumber,
        Guid            cashierId,
        Guid            transactionId,
        CancellationToken ct = default)
    {
        if (!product.TrackInventory) return;

        var newQty    = product.StockQuantity - quantity;
        var movedAt   = DateTime.UtcNow;
        var movementId = Guid.NewGuid();
        int  bypass = TenantAmbient.BypassFilter ? 1 : 0;
        Guid tenant = TenantAmbient.TenantId ?? Guid.Empty;
        // Raw INSERTs bypass StampTenantId — stamp the ambient tenant explicitly, or the
        // rows land with TenantId = NULL and the global filter hides them from their own tenant.
        Guid? stamp = TenantAmbient.TenantId;

        if (product.Schema == "pos")
        {
            // Deduct in pos.products
            await db.Database.ExecuteSqlAsync($"""
                UPDATE [pos].[products]
                SET    StockQuantity = {newQty},
                       UpdatedAt     = {movedAt}
                WHERE  Id = {product.Id} AND ({bypass} = 1 OR TenantId = {tenant})
                """, ct);

            // Record in pos.stock_movements
            // AdjustmentType: Sale = 2 (StockAdjustmentType enum)
            await db.Database.ExecuteSqlAsync($"""
                INSERT INTO [pos].[stock_movements]
                    (Id, ProductId, AdjustmentType, Quantity, BalanceAfter,
                     Reference, TransactionId, CreatedBy, CreatedAt, Notes, TenantId)
                VALUES
                    ({movementId}, {product.Id}, 2, {-quantity}, {newQty},
                     {transactionNumber}, {transactionId}, {cashierId}, {movedAt}, NULL, {stamp})
                """, ct);
        }
        else
        {
            // Deduct in inventory.products + the default warehouse's per-warehouse bucket,
            // and stamp the movement with that warehouse. One batch keeps it atomic.
            await db.Database.ExecuteSqlAsync($"""
                DECLARE @wh UNIQUEIDENTIFIER = (
                    SELECT TOP 1 Id FROM [inventory].[warehouses]
                    WHERE IsDeleted = 0 AND ({bypass} = 1 OR TenantId = {tenant})
                    ORDER BY CASE WHEN IsDefault = 1 THEN 0 ELSE 1 END, CreatedAt);

                UPDATE [inventory].[products]
                SET    StockQuantity = {newQty}, UpdatedAt = {movedAt}
                WHERE  Id = {product.Id} AND ({bypass} = 1 OR TenantId = {tenant});

                IF @wh IS NOT NULL
                BEGIN
                    UPDATE [inventory].[product_stock]
                    SET    Quantity = CASE WHEN Quantity - {quantity} < 0 THEN 0 ELSE Quantity - {quantity} END,
                           UpdatedAt = {movedAt}
                    WHERE  ProductId = {product.Id} AND WarehouseId = @wh;

                    IF @@ROWCOUNT = 0
                        INSERT INTO [inventory].[product_stock] (Id, ProductId, WarehouseId, Quantity, ReorderLevel, CreatedAt, TenantId)
                        VALUES (NEWID(), {product.Id}, @wh, 0, 0, {movedAt}, {stamp});
                END

                INSERT INTO [inventory].[stock_movements]
                    (Id, ProductId, MovementType, Quantity, UnitCost,
                     Reference, Notes, WarehouseId, MovedAt, CreatedAt, IsDeleted, TenantId)
                VALUES
                    ({movementId}, {product.Id}, 'Sale', {-quantity}, {product.SalePrice},
                     {transactionNumber}, {$"POS sale — txn {transactionNumber}"},
                     @wh, {movedAt}, {movedAt}, 0, {stamp});
                """, ct);
        }
    }

    public async Task RestoreStockAsync(
        ProductSaleView product,
        decimal         quantity,
        string          transactionNumber,
        Guid            cashierId,
        Guid            transactionId,
        CancellationToken ct = default)
    {
        if (!product.TrackInventory) return;

        var newQty     = product.StockQuantity + quantity;
        var movedAt    = DateTime.UtcNow;
        var movementId = Guid.NewGuid();
        var reference  = $"REFUND:{transactionNumber}";
        int  bypass = TenantAmbient.BypassFilter ? 1 : 0;
        Guid tenant = TenantAmbient.TenantId ?? Guid.Empty;
        // Raw INSERTs bypass StampTenantId — stamp the ambient tenant explicitly (see DeductStockAsync).
        Guid? stamp = TenantAmbient.TenantId;

        if (product.Schema == "pos")
        {
            await db.Database.ExecuteSqlAsync($"""
                UPDATE [pos].[products]
                SET    StockQuantity = {newQty},
                       UpdatedAt     = {movedAt}
                WHERE  Id = {product.Id} AND ({bypass} = 1 OR TenantId = {tenant})
                """, ct);

            // AdjustmentType: Return = 3 (StockAdjustmentType enum)
            await db.Database.ExecuteSqlAsync($"""
                INSERT INTO [pos].[stock_movements]
                    (Id, ProductId, AdjustmentType, Quantity, BalanceAfter,
                     Reference, TransactionId, CreatedBy, CreatedAt, Notes, TenantId)
                VALUES
                    ({movementId}, {product.Id}, 3, {quantity}, {newQty},
                     {reference}, {transactionId}, {cashierId}, {movedAt}, NULL, {stamp})
                """, ct);
        }
        else
        {
            // Restore inventory.products + the default warehouse's per-warehouse bucket.
            await db.Database.ExecuteSqlAsync($"""
                DECLARE @wh UNIQUEIDENTIFIER = (
                    SELECT TOP 1 Id FROM [inventory].[warehouses]
                    WHERE IsDeleted = 0 AND ({bypass} = 1 OR TenantId = {tenant})
                    ORDER BY CASE WHEN IsDefault = 1 THEN 0 ELSE 1 END, CreatedAt);

                UPDATE [inventory].[products]
                SET    StockQuantity = {newQty}, UpdatedAt = {movedAt}
                WHERE  Id = {product.Id} AND ({bypass} = 1 OR TenantId = {tenant});

                IF @wh IS NOT NULL
                BEGIN
                    UPDATE [inventory].[product_stock]
                    SET    Quantity = Quantity + {quantity}, UpdatedAt = {movedAt}
                    WHERE  ProductId = {product.Id} AND WarehouseId = @wh;

                    IF @@ROWCOUNT = 0
                        INSERT INTO [inventory].[product_stock] (Id, ProductId, WarehouseId, Quantity, ReorderLevel, CreatedAt, TenantId)
                        VALUES (NEWID(), {product.Id}, @wh, {quantity}, 0, {movedAt}, {stamp});
                END

                INSERT INTO [inventory].[stock_movements]
                    (Id, ProductId, MovementType, Quantity, UnitCost,
                     Reference, Notes, WarehouseId, MovedAt, CreatedAt, IsDeleted, TenantId)
                VALUES
                    ({movementId}, {product.Id}, 'Return', {quantity}, {product.SalePrice},
                     {reference}, {$"POS refund — txn {transactionNumber}"},
                     @wh, {movedAt}, {movedAt}, 0, {stamp});
                """, ct);
        }
    }
}
