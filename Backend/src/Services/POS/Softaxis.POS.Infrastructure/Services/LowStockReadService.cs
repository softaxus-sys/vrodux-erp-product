using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.POS.Application.Abstractions;
using Softaxis.POS.Domain.Enums;
using Softaxis.POS.Infrastructure.Persistence;

namespace Softaxis.POS.Infrastructure.Services;

public sealed class LowStockReadService(POSDbContext db) : ILowStockReadService
{
    private sealed class Row
    {
        public Guid    Id            { get; set; }
        public string  Name          { get; set; } = default!;
        public string? SKU           { get; set; }
        public string? Barcode       { get; set; }
        public string  Category      { get; set; } = default!;
        public string  Unit          { get; set; } = default!;
        public decimal StockQuantity { get; set; }
        public decimal ReorderLevel  { get; set; }
        public decimal CostPrice     { get; set; }
    }

    public async Task<IReadOnlyList<LowStockRow>> GetLowStockAsync(int salesDays, CancellationToken ct = default)
    {
        // Raw SQL bypasses EF's global tenant filter — replicate it explicitly.
        int  bypass = TenantAmbient.BypassFilter ? 1 : 0;
        Guid tenant = TenantAmbient.TenantId ?? Guid.Empty;

        // The till sells from both schemas (see CrossSchemaProductService), so both are listed.
        // "Low" = out of stock, or at/below a reorder level that has actually been set.
        var products = await db.Database
            .SqlQuery<Row>($"""
                SELECT p.Id, p.Name, p.SKU, p.Barcode,
                       ISNULL(c.Name, 'Uncategorised') AS Category,
                       p.Unit, p.StockQuantity, p.ReorderLevel, p.CostPrice
                FROM  [pos].[products] p
                LEFT  JOIN [pos].[product_categories] c ON c.Id = p.CategoryId
                WHERE p.IsDeleted = 0 AND p.IsActive = 1 AND p.TrackInventory = 1
                  AND (p.StockQuantity <= 0 OR (p.ReorderLevel > 0 AND p.StockQuantity <= p.ReorderLevel))
                  AND ({bypass} = 1 OR p.TenantId = {tenant})

                UNION ALL

                SELECT p.Id, p.Name, p.SKU, p.Barcode,
                       ISNULL(c.Name, 'Uncategorised') AS Category,
                       p.Unit, p.StockQuantity, p.ReorderLevel, p.CostPrice
                FROM  [inventory].[products] p
                LEFT  JOIN [inventory].[product_categories] c ON c.Id = p.CategoryId
                WHERE p.IsDeleted = 0 AND p.IsActive = 1 AND p.TrackInventory = 1
                  AND (p.StockQuantity <= 0 OR (p.ReorderLevel > 0 AND p.StockQuantity <= p.ReorderLevel))
                  AND ({bypass} = 1 OR p.TenantId = {tenant})
                """)
            .ToListAsync(ct);

        if (products.Count == 0) return [];

        // Completed sales only: a refunded sale puts its goods back on the shelf, so it is not demand.
        var since = DateTime.UtcNow.AddDays(-salesDays);
        var sold = await db.Transactions.AsNoTracking()
            .Where(t => !t.IsDeleted && t.CompletedAt >= since
                     && t.Type == TransactionType.Sale && t.Status == TransactionStatus.Completed)
            .SelectMany(t => t.LineItems)
            .GroupBy(li => li.ProductId)
            .Select(g => new { ProductId = g.Key, Quantity = g.Sum(li => li.Quantity) })
            .ToDictionaryAsync(x => x.ProductId, x => x.Quantity, ct);

        return products
            .Select(p => new LowStockRow(
                p.Id, p.Name, p.SKU, p.Barcode, p.Category, p.Unit,
                p.StockQuantity, p.ReorderLevel, p.CostPrice,
                sold.TryGetValue(p.Id, out var q) ? q : 0m))
            .ToList();
    }
}
