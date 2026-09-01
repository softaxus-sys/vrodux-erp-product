using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.Inventory.Application.Abstractions;
using Softaxis.Inventory.Application.DTOs;
using Softaxis.Inventory.Application.Products.Queries.GetInventoryDashboard;
using Softaxis.Inventory.Infrastructure.Persistence;

namespace Softaxis.Inventory.Infrastructure.Services;

/// <summary>
/// Raw-SQL implementation of <see cref="IProductReadService"/>.
///
/// Both POS and Inventory services share the same SQL Server database
/// (SoftaxisErpDb) but write to different schemas:
///   • pos.products        – created via the POS product-management UI
///   • inventory.products  – created via the Inventory module
///
/// This service UNIONs both sources so the Inventory stock view shows
/// every product regardless of where it was created, without requiring
/// any changes to the POS service.
/// </summary>
public sealed class ProductReadService(InventoryDbContext db) : IProductReadService
{
    // ── flat row returned by the paged UNION ─────────────────────────────────
    private sealed class Row
    {
        public Guid     Id              { get; set; }
        public string   Name            { get; set; } = default!;
        public string?  SKU             { get; set; }
        public string?  Barcode         { get; set; }
        public Guid     CategoryId      { get; set; }
        public string   CategoryName    { get; set; } = default!;
        public Guid?    BrandId         { get; set; }
        public string?  BrandName       { get; set; }
        public Guid?    UnitOfMeasureId { get; set; }
        public string?  UomSymbol       { get; set; }
        public decimal  SalePrice       { get; set; }
        public decimal  CostPrice       { get; set; }
        public decimal  TaxRate         { get; set; }
        public string   Unit            { get; set; } = default!;
        public decimal  StockQuantity   { get; set; }
        public decimal  ReorderLevel    { get; set; }
        public bool     IsActive        { get; set; }
        public bool     TrackInventory  { get; set; }
        public bool     IsLowStock      { get; set; }
        public string?  ImageUrl        { get; set; }
        public DateTime CreatedAt       { get; set; }
        public int      TotalCount      { get; set; }  // COUNT(*) OVER ()
    }

    // ── flat row returned by the single-product UNION ─────────────────────────
    private sealed class DetailRow
    {
        public Guid      Id              { get; set; }
        public string    Name            { get; set; } = default!;
        public string?   Description     { get; set; }
        public string?   SKU             { get; set; }
        public string?   Barcode         { get; set; }
        public Guid      CategoryId      { get; set; }
        public string    CategoryName    { get; set; } = default!;
        public Guid?     BrandId         { get; set; }
        public string?   BrandName       { get; set; }
        public Guid?     UnitOfMeasureId { get; set; }
        public string?   UomSymbol       { get; set; }
        public decimal   SalePrice       { get; set; }
        public decimal   CostPrice       { get; set; }
        public decimal   TaxRate         { get; set; }
        public string    Unit            { get; set; } = default!;
        public decimal   StockQuantity   { get; set; }
        public decimal   ReorderLevel    { get; set; }
        public bool      IsActive        { get; set; }
        public bool      TrackInventory  { get; set; }
        public bool      IsLowStock      { get; set; }
        public string?   ImageUrl        { get; set; }
        public DateTime  CreatedAt       { get; set; }
        public DateTime? UpdatedAt       { get; set; }
    }

    // ─────────────────────────────────────────────────────────────────────────

    public async Task<PagedResult<ProductSummaryDto>> GetCombinedPagedAsync(
        int     page,
        int     pageSize,
        string? search     = null,
        Guid?   categoryId = null,
        bool?   isActive   = null,
        bool?   isLowStock = null,
        CancellationToken ct = default)
    {
        // LIKE pattern — null means "no search filter"
        string? pattern = string.IsNullOrWhiteSpace(search)
            ? null
            : $"%{search.Trim()}%";

        // isLowStock is only applied when the caller explicitly passes true
        bool? lowStockFilter = isLowStock == true ? true : (bool?)null;

        int offset = (page - 1) * pageSize;

        // Tenant scope — raw SQL bypasses EF's global query filter, so we replicate it:
        // bypass=1 (super-admin / unresolved) returns all rows; otherwise only this tenant's.
        int  bypass = TenantAmbient.BypassFilter ? 1 : 0;
        Guid tenant = TenantAmbient.TenantId ?? Guid.Empty;

        // EF Core 8+ SqlQuery<T> with FormattableString: each {expr} becomes
        // a parameterised SQL value — safe from injection.
        var rows = await db.Database
            .SqlQuery<Row>($"""
                WITH Combined AS (
                    -- ── POS products ──────────────────────────────────────────────
                    SELECT
                        p.Id,
                        p.Name,
                        p.SKU,
                        p.Barcode,
                        p.CategoryId,
                        c.Name            AS CategoryName,
                        CAST(NULL AS uniqueidentifier)  AS BrandId,
                        CAST(NULL AS nvarchar(200))     AS BrandName,
                        CAST(NULL AS uniqueidentifier)  AS UnitOfMeasureId,
                        CAST(NULL AS nvarchar(20))      AS UomSymbol,
                        p.SalePrice,
                        p.CostPrice,
                        p.TaxRate,
                        p.Unit,
                        p.StockQuantity,
                        p.ReorderLevel,
                        p.IsActive,
                        p.TrackInventory,
                        CAST(
                            CASE WHEN p.TrackInventory = 1
                                      AND p.StockQuantity <= p.ReorderLevel
                                      AND p.ReorderLevel  > 0
                            THEN 1 ELSE 0 END
                        AS bit)           AS IsLowStock,
                        p.ImageUrl,
                        p.CreatedAt
                    FROM  [pos].[products]          p
                    INNER JOIN [pos].[product_categories] c ON c.Id = p.CategoryId
                    WHERE p.IsDeleted = 0 AND ({bypass} = 1 OR p.TenantId = {tenant})

                    UNION ALL

                    -- ── Inventory products ────────────────────────────────────────
                    SELECT
                        p.Id,
                        p.Name,
                        p.SKU,
                        p.Barcode,
                        p.CategoryId,
                        c.Name            AS CategoryName,
                        p.BrandId,
                        b.Name            AS BrandName,
                        p.UnitOfMeasureId,
                        u.Symbol          AS UomSymbol,
                        p.SalePrice,
                        p.CostPrice,
                        p.TaxRate,
                        p.Unit,
                        p.StockQuantity,
                        p.ReorderLevel,
                        p.IsActive,
                        p.TrackInventory,
                        CAST(
                            CASE WHEN p.TrackInventory = 1
                                      AND p.StockQuantity <= p.ReorderLevel
                                      AND p.ReorderLevel  > 0
                            THEN 1 ELSE 0 END
                        AS bit)           AS IsLowStock,
                        p.ImageUrl,
                        p.CreatedAt
                    FROM  [inventory].[products]          p
                    INNER JOIN [inventory].[product_categories] c ON c.Id = p.CategoryId
                    LEFT  JOIN [inventory].[brands]             b ON b.Id = p.BrandId
                    LEFT  JOIN [inventory].[units_of_measure]   u ON u.Id = p.UnitOfMeasureId
                    WHERE p.IsDeleted = 0 AND ({bypass} = 1 OR p.TenantId = {tenant})
                ),
                Filtered AS (
                    SELECT *, COUNT(*) OVER () AS TotalCount
                    FROM   Combined
                    WHERE  (
                               {pattern} IS NULL
                            OR Name    LIKE {pattern}
                            OR (SKU     IS NOT NULL AND SKU     LIKE {pattern})
                            OR (Barcode IS NOT NULL AND Barcode LIKE {pattern})
                           )
                      AND  ({categoryId} IS NULL OR CategoryId = {categoryId})
                      AND  ({isActive}   IS NULL OR IsActive   = {isActive})
                      AND  ({lowStockFilter} IS NULL OR IsLowStock = 1)
                )
                SELECT *
                FROM   Filtered
                ORDER  BY Name
                OFFSET {offset} ROWS FETCH NEXT {pageSize} ROWS ONLY
                """)
            .ToListAsync(ct);

        int total = rows.FirstOrDefault()?.TotalCount ?? 0;

        var dtos = rows.Select(r => new ProductSummaryDto(
            r.Id,
            r.Name,
            r.SKU,
            r.Barcode,
            r.CategoryId,
            r.CategoryName,
            r.BrandId,
            r.BrandName,
            r.UnitOfMeasureId,
            r.UomSymbol,
            r.SalePrice,
            r.CostPrice,
            r.TaxRate,
            r.Unit,
            r.StockQuantity,
            r.ReorderLevel,
            r.IsActive,
            r.TrackInventory,
            r.IsLowStock,
            r.ImageUrl,
            r.CreatedAt)).ToList();

        return PagedResult<ProductSummaryDto>.Create(dtos, total, page, pageSize);
    }

    // ─────────────────────────────────────────────────────────────────────────

    public async Task<ProductDto?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        int  bypass = TenantAmbient.BypassFilter ? 1 : 0;
        Guid tenant = TenantAmbient.TenantId ?? Guid.Empty;

        var row = await db.Database
            .SqlQuery<DetailRow>($"""
                SELECT TOP 1
                    p.Id, p.Name, p.Description, p.SKU, p.Barcode,
                    p.CategoryId,
                    c.Name                          AS CategoryName,
                    CAST(NULL AS uniqueidentifier)  AS BrandId,
                    CAST(NULL AS nvarchar(200))      AS BrandName,
                    CAST(NULL AS uniqueidentifier)  AS UnitOfMeasureId,
                    CAST(NULL AS nvarchar(20))       AS UomSymbol,
                    p.SalePrice, p.CostPrice, p.TaxRate, p.Unit,
                    p.StockQuantity, p.ReorderLevel,
                    p.IsActive, p.TrackInventory,
                    CAST(
                        CASE WHEN p.TrackInventory = 1
                                  AND p.StockQuantity <= p.ReorderLevel
                                  AND p.ReorderLevel  > 0
                        THEN 1 ELSE 0 END
                    AS bit)                         AS IsLowStock,
                    p.ImageUrl, p.CreatedAt,
                    p.UpdatedAt
                FROM  [pos].[products]          p
                INNER JOIN [pos].[product_categories] c ON c.Id = p.CategoryId
                WHERE p.IsDeleted = 0 AND p.Id = {id} AND ({bypass} = 1 OR p.TenantId = {tenant})

                UNION ALL

                SELECT TOP 1
                    p.Id, p.Name, p.Description, p.SKU, p.Barcode,
                    p.CategoryId,
                    c.Name      AS CategoryName,
                    p.BrandId,
                    b.Name      AS BrandName,
                    p.UnitOfMeasureId,
                    u.Symbol    AS UomSymbol,
                    p.SalePrice, p.CostPrice, p.TaxRate, p.Unit,
                    p.StockQuantity, p.ReorderLevel,
                    p.IsActive, p.TrackInventory,
                    CAST(
                        CASE WHEN p.TrackInventory = 1
                                  AND p.StockQuantity <= p.ReorderLevel
                                  AND p.ReorderLevel  > 0
                        THEN 1 ELSE 0 END
                    AS bit)     AS IsLowStock,
                    p.ImageUrl, p.CreatedAt,
                    p.UpdatedAt
                FROM  [inventory].[products]          p
                INNER JOIN [inventory].[product_categories] c ON c.Id = p.CategoryId
                LEFT  JOIN [inventory].[brands]             b ON b.Id = p.BrandId
                LEFT  JOIN [inventory].[units_of_measure]   u ON u.Id = p.UnitOfMeasureId
                WHERE p.IsDeleted = 0 AND p.Id = {id} AND ({bypass} = 1 OR p.TenantId = {tenant})
                """)
            .FirstOrDefaultAsync(ct);

        if (row is null) return null;

        return new ProductDto(
            row.Id, row.Name, row.Description, row.SKU, row.Barcode,
            row.CategoryId, row.CategoryName,
            row.BrandId, row.BrandName,
            row.UnitOfMeasureId, row.UomSymbol,
            row.SalePrice, row.CostPrice, row.TaxRate, row.Unit,
            row.StockQuantity, row.ReorderLevel,
            row.IsActive, row.TrackInventory, row.IsLowStock,
            row.ImageUrl, row.CreatedAt, row.UpdatedAt);
    }

    // ─────────────────────────────────────────────────────────────────────────

    public async Task<ProductDto?> GetByBarcodeAsync(string barcode, CancellationToken ct = default)
    {
        int  bypass = TenantAmbient.BypassFilter ? 1 : 0;
        Guid tenant = TenantAmbient.TenantId ?? Guid.Empty;

        var row = await db.Database
            .SqlQuery<DetailRow>($"""
                SELECT TOP 1
                    p.Id, p.Name, p.Description, p.SKU, p.Barcode,
                    p.CategoryId,
                    c.Name                          AS CategoryName,
                    CAST(NULL AS uniqueidentifier)  AS BrandId,
                    CAST(NULL AS nvarchar(200))      AS BrandName,
                    CAST(NULL AS uniqueidentifier)  AS UnitOfMeasureId,
                    CAST(NULL AS nvarchar(20))       AS UomSymbol,
                    p.SalePrice, p.CostPrice, p.TaxRate, p.Unit,
                    p.StockQuantity, p.ReorderLevel,
                    p.IsActive, p.TrackInventory,
                    CAST(
                        CASE WHEN p.TrackInventory = 1
                                  AND p.StockQuantity <= p.ReorderLevel
                                  AND p.ReorderLevel  > 0
                        THEN 1 ELSE 0 END
                    AS bit)                         AS IsLowStock,
                    p.ImageUrl, p.CreatedAt, p.UpdatedAt
                FROM  [pos].[products]          p
                INNER JOIN [pos].[product_categories] c ON c.Id = p.CategoryId
                WHERE p.IsDeleted = 0 AND p.Barcode = {barcode} AND ({bypass} = 1 OR p.TenantId = {tenant})

                UNION ALL

                SELECT TOP 1
                    p.Id, p.Name, p.Description, p.SKU, p.Barcode,
                    p.CategoryId,
                    c.Name      AS CategoryName,
                    p.BrandId,
                    b.Name      AS BrandName,
                    p.UnitOfMeasureId,
                    u.Symbol    AS UomSymbol,
                    p.SalePrice, p.CostPrice, p.TaxRate, p.Unit,
                    p.StockQuantity, p.ReorderLevel,
                    p.IsActive, p.TrackInventory,
                    CAST(
                        CASE WHEN p.TrackInventory = 1
                                  AND p.StockQuantity <= p.ReorderLevel
                                  AND p.ReorderLevel  > 0
                        THEN 1 ELSE 0 END
                    AS bit)     AS IsLowStock,
                    p.ImageUrl, p.CreatedAt, p.UpdatedAt
                FROM  [inventory].[products]          p
                INNER JOIN [inventory].[product_categories] c ON c.Id = p.CategoryId
                LEFT  JOIN [inventory].[brands]             b ON b.Id = p.BrandId
                LEFT  JOIN [inventory].[units_of_measure]   u ON u.Id = p.UnitOfMeasureId
                WHERE p.IsDeleted = 0 AND p.Barcode = {barcode} AND ({bypass} = 1 OR p.TenantId = {tenant})
                """)
            .FirstOrDefaultAsync(ct);

        if (row is null) return null;

        return new ProductDto(
            row.Id, row.Name, row.Description, row.SKU, row.Barcode,
            row.CategoryId, row.CategoryName,
            row.BrandId, row.BrandName,
            row.UnitOfMeasureId, row.UomSymbol,
            row.SalePrice, row.CostPrice, row.TaxRate, row.Unit,
            row.StockQuantity, row.ReorderLevel,
            row.IsActive, row.TrackInventory, row.IsLowStock,
            row.ImageUrl, row.CreatedAt, row.UpdatedAt);
    }

    private sealed record CatRow(string Category, int InStock, int LowStock, int OutOfStock, decimal Value);

    public async Task<InventoryDashboardDto> GetDashboardAsync(CancellationToken ct = default)
    {
        // Same union and the same tenant guard the list uses — the charts must agree with the grid.
        int  bypass = TenantAmbient.BypassFilter ? 1 : 0;
        Guid tenant = TenantAmbient.TenantId ?? Guid.Empty;

        var rows = await db.Database
            .SqlQuery<CatRow>($"""
                WITH Combined AS (
                    SELECT ISNULL(c.Name, 'Uncategorised') AS Category,
                           p.StockQuantity, p.ReorderLevel, p.TrackInventory, p.CostPrice
                    FROM  [pos].[products] p
                    INNER JOIN [pos].[product_categories] c ON c.Id = p.CategoryId
                    WHERE p.IsDeleted = 0 AND ({bypass} = 1 OR p.TenantId = {tenant})

                    UNION ALL

                    SELECT ISNULL(c.Name, 'Uncategorised') AS Category,
                           p.StockQuantity, p.ReorderLevel, p.TrackInventory, p.CostPrice
                    FROM  [inventory].[products] p
                    INNER JOIN [inventory].[product_categories] c ON c.Id = p.CategoryId
                    WHERE p.IsDeleted = 0 AND ({bypass} = 1 OR p.TenantId = {tenant})
                )
                SELECT
                    Category,
                    SUM(CASE WHEN StockQuantity <= 0 THEN 0
                             WHEN TrackInventory = 1 AND ReorderLevel > 0
                                  AND StockQuantity <= ReorderLevel THEN 0
                             ELSE 1 END)                                AS InStock,
                    SUM(CASE WHEN StockQuantity > 0 AND TrackInventory = 1
                                  AND ReorderLevel > 0
                                  AND StockQuantity <= ReorderLevel
                             THEN 1 ELSE 0 END)                         AS LowStock,
                    SUM(CASE WHEN StockQuantity <= 0 THEN 1 ELSE 0 END) AS OutOfStock,
                    SUM(StockQuantity * CostPrice)                      AS Value
                FROM   Combined
                GROUP  BY Category
                """)
            .ToListAsync(ct);

        // Top 6 categories by product count — the chart has room for six bars.
        var byCategory = rows
            .OrderByDescending(r => r.InStock + r.LowStock + r.OutOfStock)
            .Take(6)
            .Select(r => new StockByCategoryDto(r.Category, r.InStock, r.LowStock, r.OutOfStock))
            .ToList();

        // Valuation: top 4 plus an "Other" bucket, so the donut stays readable and still totals
        // the whole portfolio rather than quietly dropping the tail.
        var valued = rows
            .Where(r => r.Value > 0)
            .OrderByDescending(r => r.Value)
            .Select(r => new CategoryValuationDto(r.Category, r.Value))
            .ToList();

        var valuation = valued.Count <= 5
            ? valued
            : valued.Take(4)
                .Append(new CategoryValuationDto("Other", valued.Skip(4).Sum(v => v.Value)))
                .ToList();

        return new InventoryDashboardDto(byCategory, valuation);
    }
}
