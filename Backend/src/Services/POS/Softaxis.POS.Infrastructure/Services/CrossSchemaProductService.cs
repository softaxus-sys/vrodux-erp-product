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
///
/// <para>
/// <b>Stock per branch.</b> A sale made in a branch's shift takes stock from THAT branch only:
/// POS-catalogue products from <c>pos.branch_stock</c>, Inventory-module products from the branch's own
/// warehouse (<c>inventory.warehouses.BranchId</c>). A branch that keeps no stock of its own for a product
/// (single-location shops, or a product nobody has allocated to branches yet) behaves exactly as before,
/// against the head-office figure.
/// </para>
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

    private sealed class DecimalRow { public decimal Value { get; set; } }
    private sealed class GuidRow    { public Guid    Value { get; set; } }
    private sealed class CountRow   { public int     Value { get; set; } }
    private sealed class BranchQtyRow { public Guid ProductId { get; set; } public decimal Quantity { get; set; } }

    public async Task<ProductSaleView?> GetByIdForSaleAsync(Guid id, Guid? branchId = null, CancellationToken ct = default)
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

        var view = new ProductSaleView(
            row.Id, row.Name, row.SKU, row.Barcode,
            row.SalePrice, row.TaxRate, row.Unit,
            row.StockQuantity, row.ReorderLevel,
            row.IsActive, row.TrackInventory, row.Schema);

        if (branchId is not Guid branch || !row.TrackInventory) return view;

        if (row.Schema == "pos")
        {
            // Does anyone keep stock of this product per branch? If not, it is still head-office stock.
            var holders = await db.Database
                .SqlQuery<CountRow>($"""
                    SELECT COUNT(*) AS [Value] FROM [pos].[branch_stock]
                    WHERE ProductId = {id} AND IsDeleted = 0 AND ({bypass} = 1 OR TenantId = {tenant})
                    """).FirstAsync(ct);
            if (holders.Value == 0) return view;

            var mine = await db.Database
                .SqlQuery<DecimalRow>($"""
                    SELECT TOP 1 StockQuantity AS [Value] FROM [pos].[branch_stock]
                    WHERE ProductId = {id} AND BranchId = {branch} AND IsDeleted = 0 AND ({bypass} = 1 OR TenantId = {tenant})
                    """).FirstOrDefaultAsync(ct);
            return view with { StockQuantity = mine?.Value ?? 0m, StockBranchId = branch };
        }

        // Inventory-module product: the branch's own warehouse, when it has one.
        var wh = await db.Database
            .SqlQuery<GuidRow>($"""
                SELECT TOP 1 Id AS [Value] FROM [inventory].[warehouses]
                WHERE IsDeleted = 0 AND BranchId = {branch} AND ({bypass} = 1 OR TenantId = {tenant})
                ORDER BY CASE WHEN IsDefault = 1 THEN 0 ELSE 1 END, CreatedAt
                """).FirstOrDefaultAsync(ct);
        if (wh is null) return view;

        var bucket = await db.Database
            .SqlQuery<DecimalRow>($"""
                SELECT TOP 1 Quantity AS [Value] FROM [inventory].[product_stock]
                WHERE ProductId = {id} AND WarehouseId = {wh.Value}
                """).FirstOrDefaultAsync(ct);
        return view with { StockQuantity = bucket?.Value ?? 0m, StockWarehouseId = wh.Value };
    }

    public async Task<IReadOnlyDictionary<Guid, decimal>> GetBranchQuantitiesAsync(
        Guid branchId, IReadOnlyCollection<Guid> productIds, CancellationToken ct = default)
    {
        if (productIds.Count == 0) return new Dictionary<Guid, decimal>();
        int  bypass = TenantAmbient.BypassFilter ? 1 : 0;
        Guid tenant = TenantAmbient.TenantId ?? Guid.Empty;

        // Only products that SOME branch holds are branch-managed; for those, this branch's row (or 0).
        var rows = await db.Database
            .SqlQuery<BranchQtyRow>($"""
                SELECT p.Id AS ProductId, ISNULL(mine.StockQuantity, 0) AS Quantity
                FROM [pos].[products] p
                LEFT JOIN [pos].[branch_stock] mine
                       ON mine.ProductId = p.Id AND mine.BranchId = {branchId} AND mine.IsDeleted = 0
                WHERE p.IsDeleted = 0 AND ({bypass} = 1 OR p.TenantId = {tenant})
                  AND EXISTS (SELECT 1 FROM [pos].[branch_stock] any_b WHERE any_b.ProductId = p.Id AND any_b.IsDeleted = 0)
                """).ToListAsync(ct);

        var wanted = productIds.ToHashSet();
        return rows.Where(r => wanted.Contains(r.ProductId)).ToDictionary(r => r.ProductId, r => r.Quantity);
    }

    public async Task<decimal> AdjustBranchStockAsync(
        Guid productId, Guid branchId, decimal delta, string adjustmentType, string? reference, string? notes,
        Guid userId, CancellationToken ct = default)
    {
        int  bypass = TenantAmbient.BypassFilter ? 1 : 0;
        Guid tenant = TenantAmbient.TenantId ?? Guid.Empty;
        Guid? stamp = TenantAmbient.TenantId;
        var  now    = DateTime.UtcNow;

        var current = await db.Database
            .SqlQuery<DecimalRow>($"""
                SELECT TOP 1 StockQuantity AS [Value] FROM [pos].[branch_stock]
                WHERE ProductId = {productId} AND BranchId = {branchId} AND IsDeleted = 0 AND ({bypass} = 1 OR TenantId = {tenant})
                """).FirstOrDefaultAsync(ct);
        var balance = (current?.Value ?? 0m) + delta;

        await db.Database.ExecuteSqlAsync($"""
            UPDATE [pos].[branch_stock]
            SET    StockQuantity = {balance}, UpdatedAt = {now}
            WHERE  ProductId = {productId} AND BranchId = {branchId} AND IsDeleted = 0 AND ({bypass} = 1 OR TenantId = {tenant});

            IF @@ROWCOUNT = 0
                INSERT INTO [pos].[branch_stock] (Id, TenantId, BranchId, ProductId, StockQuantity, CreatedAt, CreatedBy, IsDeleted)
                VALUES ({Guid.NewGuid()}, {stamp}, {branchId}, {productId}, {balance}, {now}, 'pos-adjust', 0);
            """, ct);

        var type = adjustmentType switch { "Purchase" => 1, "Sale" => 2, "Return" => 3, _ => 0 };
        await db.Database.ExecuteSqlAsync($"""
            INSERT INTO [pos].[stock_movements]
                (Id, ProductId, AdjustmentType, Quantity, BalanceAfter,
                 Reference, TransactionId, CreatedBy, CreatedAt, Notes, TenantId, BranchId)
            VALUES
                ({Guid.NewGuid()}, {productId}, {type}, {delta}, {balance},
                 {reference}, NULL, {userId}, {now}, {notes}, {stamp}, {branchId})
            """, ct);

        return balance;
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
            if (product.StockBranchId is Guid branch)
            {
                // This branch's own stock: only its row changes, head office's figure is left alone.
                await db.Database.ExecuteSqlAsync($"""
                    UPDATE [pos].[branch_stock]
                    SET    StockQuantity = StockQuantity - {quantity}, UpdatedAt = {movedAt}
                    WHERE  ProductId = {product.Id} AND BranchId = {branch} AND IsDeleted = 0 AND ({bypass} = 1 OR TenantId = {tenant});

                    IF @@ROWCOUNT = 0
                        INSERT INTO [pos].[branch_stock] (Id, TenantId, BranchId, ProductId, StockQuantity, CreatedAt, CreatedBy, IsDeleted)
                        VALUES ({Guid.NewGuid()}, {stamp}, {branch}, {product.Id}, {-quantity}, {movedAt}, 'pos-sale', 0);

                    INSERT INTO [pos].[stock_movements]
                        (Id, ProductId, AdjustmentType, Quantity, BalanceAfter,
                         Reference, TransactionId, CreatedBy, CreatedAt, Notes, TenantId, BranchId)
                    VALUES
                        ({movementId}, {product.Id}, 2, {-quantity}, {newQty},
                         {transactionNumber}, {transactionId}, {cashierId}, {movedAt}, NULL, {stamp}, {branch});
                    """, ct);
                return;
            }

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
            // Deduct in inventory.products + the warehouse's per-warehouse bucket - the selling branch's own
            // warehouse when the till knows it, otherwise the default one - and stamp the movement with that
            // warehouse. One batch keeps it atomic. The product's total is kept as the sum of its buckets.
            Guid? known = product.StockWarehouseId;
            await db.Database.ExecuteSqlAsync($"""
                DECLARE @wh UNIQUEIDENTIFIER = COALESCE({known}, (
                    SELECT TOP 1 Id FROM [inventory].[warehouses]
                    WHERE IsDeleted = 0 AND ({bypass} = 1 OR TenantId = {tenant})
                    ORDER BY CASE WHEN IsDefault = 1 THEN 0 ELSE 1 END, CreatedAt));

                UPDATE [inventory].[products]
                SET    StockQuantity = StockQuantity - {quantity}, UpdatedAt = {movedAt}
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
            if (product.StockBranchId is Guid branch)
            {
                await db.Database.ExecuteSqlAsync($"""
                    UPDATE [pos].[branch_stock]
                    SET    StockQuantity = StockQuantity + {quantity}, UpdatedAt = {movedAt}
                    WHERE  ProductId = {product.Id} AND BranchId = {branch} AND IsDeleted = 0 AND ({bypass} = 1 OR TenantId = {tenant});

                    IF @@ROWCOUNT = 0
                        INSERT INTO [pos].[branch_stock] (Id, TenantId, BranchId, ProductId, StockQuantity, CreatedAt, CreatedBy, IsDeleted)
                        VALUES ({Guid.NewGuid()}, {stamp}, {branch}, {product.Id}, {quantity}, {movedAt}, 'pos-return', 0);

                    INSERT INTO [pos].[stock_movements]
                        (Id, ProductId, AdjustmentType, Quantity, BalanceAfter,
                         Reference, TransactionId, CreatedBy, CreatedAt, Notes, TenantId, BranchId)
                    VALUES
                        ({movementId}, {product.Id}, 3, {quantity}, {newQty},
                         {reference}, {transactionId}, {cashierId}, {movedAt}, NULL, {stamp}, {branch});
                    """, ct);
                return;
            }

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
            // Restore inventory.products + the warehouse's per-warehouse bucket (the branch's own when known).
            Guid? known = product.StockWarehouseId;
            await db.Database.ExecuteSqlAsync($"""
                DECLARE @wh UNIQUEIDENTIFIER = COALESCE({known}, (
                    SELECT TOP 1 Id FROM [inventory].[warehouses]
                    WHERE IsDeleted = 0 AND ({bypass} = 1 OR TenantId = {tenant})
                    ORDER BY CASE WHEN IsDefault = 1 THEN 0 ELSE 1 END, CreatedAt));

                UPDATE [inventory].[products]
                SET    StockQuantity = StockQuantity + {quantity}, UpdatedAt = {movedAt}
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
