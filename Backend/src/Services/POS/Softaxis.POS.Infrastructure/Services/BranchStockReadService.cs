using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.POS.Application.Stock;
using Softaxis.POS.Infrastructure.Persistence;

namespace Softaxis.POS.Infrastructure.Services;

public sealed class BranchStockReadService(POSDbContext db) : IBranchStockReadService
{
    private sealed class Row
    {
        public Guid     ProductId     { get; set; }
        public string   ProductName   { get; set; } = default!;
        public string?  Sku           { get; set; }
        public string   Unit          { get; set; } = default!;
        public decimal  ReorderLevel  { get; set; }
        public Guid     BranchId      { get; set; }
        public string   BranchName    { get; set; } = default!;
        public decimal  StockQuantity { get; set; }
        public DateTime? AsOf         { get; set; }
    }

    public async Task<IReadOnlyList<BranchStockRowDto>> GetAsync(Guid? productId, Guid? branchId, string? search, CancellationToken ct = default)
    {
        // Raw SQL bypasses EF's global tenant filter - replicate it explicitly.
        int  bypass = TenantAmbient.BypassFilter ? 1 : 0;
        Guid tenant = TenantAmbient.TenantId ?? Guid.Empty;
        var  like   = string.IsNullOrWhiteSpace(search) ? null : $"%{search.Trim()}%";

        // A branch's stock lives in two places: pos.branch_stock for products still in the POS schema, and a
        // per-branch warehouse (inventory.product_stock) for products in Inventory. Both are listed.
        var rows = await db.Database.SqlQuery<Row>($"""
            SELECT TOP 2000 * FROM (
                SELECT p.Id AS ProductId, p.Name AS ProductName, p.SKU AS Sku, p.Unit, p.ReorderLevel,
                       b.BranchId, ISNULL(br.Name, 'Unknown branch') AS BranchName, b.StockQuantity,
                       ISNULL(b.UpdatedAt, b.CreatedAt) AS AsOf
                FROM  [pos].[branch_stock] b
                JOIN  [pos].[products] p ON p.Id = b.ProductId AND p.IsDeleted = 0
                LEFT  JOIN [identity].[branches] br ON br.Id = b.BranchId
                WHERE b.IsDeleted = 0
                  AND ({bypass} = 1 OR b.TenantId = {tenant})
                  AND ({productId} IS NULL OR b.ProductId = {productId})
                  AND ({branchId}  IS NULL OR b.BranchId  = {branchId})
                  AND ({like} IS NULL OR p.Name LIKE {like} OR p.SKU LIKE {like} OR p.Barcode LIKE {like})

                UNION ALL

                SELECT p.Id, p.Name, p.SKU, p.Unit, p.ReorderLevel,
                       w.BranchId, ISNULL(br.Name, 'Unknown branch'), s.Quantity,
                       ISNULL(s.UpdatedAt, s.CreatedAt)
                FROM  [inventory].[product_stock] s
                JOIN  [inventory].[warehouses] w ON w.Id = s.WarehouseId AND w.IsDeleted = 0 AND w.BranchId IS NOT NULL
                JOIN  [inventory].[products] p ON p.Id = s.ProductId AND p.IsDeleted = 0
                LEFT  JOIN [identity].[branches] br ON br.Id = w.BranchId
                WHERE ({bypass} = 1 OR s.TenantId = {tenant})
                  AND ({productId} IS NULL OR s.ProductId = {productId})
                  AND ({branchId}  IS NULL OR w.BranchId  = {branchId})
                  AND ({like} IS NULL OR p.Name LIKE {like} OR p.SKU LIKE {like} OR p.Barcode LIKE {like})
            ) x
            ORDER BY x.ProductName, x.BranchName
            """).ToListAsync(ct);

        return rows.Select(r => new BranchStockRowDto(
            r.ProductId, r.ProductName, r.Sku, r.Unit, r.ReorderLevel,
            r.BranchId, r.BranchName, r.StockQuantity, r.AsOf)).ToList();
    }
}
