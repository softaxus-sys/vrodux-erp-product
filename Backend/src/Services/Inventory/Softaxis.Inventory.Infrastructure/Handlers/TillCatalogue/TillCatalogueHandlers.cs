using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Application.DTOs;
using Softaxis.Inventory.Application.TillCatalogue;
using Softaxis.Inventory.Domain.Constants;
using Softaxis.Inventory.Domain.Entities;
using Softaxis.Inventory.Infrastructure.Persistence;

namespace Softaxis.Inventory.Infrastructure.Handlers.TillCatalogue;

internal static class TillCatalogueSupport
{
    /// <summary>The till's own limit on a barcode (its Barcode value object).</summary>
    public const int MaxBarcodeLength = 50;

    public static async Task<ProductDto> ToDtoAsync(InventoryDbContext db, Guid id, CancellationToken ct)
    {
        var p = await db.Products.AsNoTracking()
            .Include(x => x.Category).Include(x => x.Brand).Include(x => x.UnitOfMeasure)
            .FirstAsync(x => x.Id == id, ct);
        return new ProductDto(
            p.Id, p.Name, p.Description, p.SKU, p.Barcode, p.CategoryId, p.Category.Name,
            p.BrandId, p.Brand?.Name, p.UnitOfMeasureId, p.UnitOfMeasure?.Symbol,
            p.SalePrice, p.CostPrice, p.TaxRate, p.Unit, p.StockQuantity, p.ReorderLevel,
            p.IsActive, p.TrackInventory, p.IsLowStock, p.ImageUrl, p.CreatedAt, p.UpdatedAt);
    }

    /// <summary>Trimmed barcode, or null when blank. A too-long one is an error, as it is at the till.</summary>
    public static Result<string?> CleanBarcode(string? barcode)
    {
        if (string.IsNullOrWhiteSpace(barcode)) return Result.Success<string?>(null);
        var t = barcode.Trim();
        return t.Length > MaxBarcodeLength
            ? Result.Failure<string?>(Error.Custom("Barcode.TooLong", $"Barcode cannot exceed {MaxBarcodeLength} characters."))
            : Result.Success<string?>(t);
    }

    public static async Task<Error?> UniquenessAsync(
        InventoryDbContext db, string? sku, string? barcode, Guid? exceptId, CancellationToken ct)
    {
        if (barcode is not null && await db.Products.AnyAsync(p => p.Barcode == barcode && p.Id != (exceptId ?? Guid.Empty), ct))
            return Error.Custom("Product.BarcodeTaken", $"Barcode '{barcode}' is already in use.");

        var normalSku = string.IsNullOrWhiteSpace(sku) ? null : sku.Trim().ToUpperInvariant();
        if (normalSku is not null && await db.Products.AnyAsync(p => p.SKU == normalSku && p.Id != (exceptId ?? Guid.Empty), ct))
            return Error.Custom("Product.SKUTaken", $"SKU '{sku}' is already in use.");
        return null;
    }
}

internal sealed class TillCreateProductHandler(InventoryDbContext db)
    : ICommandHandler<TillCreateProductCommand, ProductDto>
{
    public async Task<Result<ProductDto>> Handle(TillCreateProductCommand cmd, CancellationToken ct)
    {
        if (!await db.ProductCategories.AnyAsync(c => c.Id == cmd.CategoryId, ct))
            return Result.Failure<ProductDto>(Error.NotFoundById("Category", cmd.CategoryId));

        var barcode = TillCatalogueSupport.CleanBarcode(cmd.Barcode);
        if (barcode.IsFailure) return Result.Failure<ProductDto>(barcode.Error);

        var clash = await TillCatalogueSupport.UniquenessAsync(db, cmd.SKU, barcode.Value, null, ct);
        if (clash is not null) return Result.Failure<ProductDto>(clash);

        var product = new Product(
            cmd.Name, cmd.Description, cmd.SKU, barcode.Value, cmd.CategoryId, null, null,
            cmd.SalePrice, cmd.CostPrice, cmd.TaxRate, cmd.Unit, cmd.OpeningStock, cmd.ReorderLevel,
            cmd.TrackInventory, cmd.ImageUrl);
        db.Products.Add(product);

        // The same opening-stock record the Inventory screen leaves, so the stock card agrees either way.
        if (cmd.TrackInventory && cmd.OpeningStock > 0)
            db.StockMovements.Add(new StockMovement(
                product.Id, MovementTypes.Receipt, cmd.OpeningStock, cmd.CostPrice, "OPENING", "Opening stock", null));

        await db.SaveChangesAsync(ct);
        return Result.Success(await TillCatalogueSupport.ToDtoAsync(db, product.Id, ct));
    }
}

internal sealed class TillUpdateProductHandler(InventoryDbContext db)
    : ICommandHandler<TillUpdateProductCommand, ProductDto>
{
    public async Task<Result<ProductDto>> Handle(TillUpdateProductCommand cmd, CancellationToken ct)
    {
        var product = await db.Products.FirstOrDefaultAsync(p => p.Id == cmd.Id, ct);
        if (product is null) return Result.Failure<ProductDto>(Error.NotFoundById("Product", cmd.Id));

        if (!await db.ProductCategories.AnyAsync(c => c.Id == cmd.CategoryId, ct))
            return Result.Failure<ProductDto>(Error.NotFoundById("Category", cmd.CategoryId));

        var barcode = TillCatalogueSupport.CleanBarcode(cmd.Barcode);
        if (barcode.IsFailure) return Result.Failure<ProductDto>(barcode.Error);

        var clash = await TillCatalogueSupport.UniquenessAsync(db, cmd.SKU, barcode.Value, cmd.Id, ct);
        if (clash is not null) return Result.Failure<ProductDto>(clash);

        // Brand and unit of measure are not on the till's form: pass the current ones through untouched.
        product.Update(
            cmd.Name, cmd.Description, cmd.SKU, barcode.Value, cmd.CategoryId, product.BrandId, product.UnitOfMeasureId,
            cmd.SalePrice, cmd.CostPrice, cmd.TaxRate, cmd.Unit, cmd.ReorderLevel, cmd.TrackInventory, cmd.ImageUrl);
        if (cmd.IsActive) product.Activate(); else product.Deactivate();

        await db.SaveChangesAsync(ct);
        return Result.Success(await TillCatalogueSupport.ToDtoAsync(db, product.Id, ct));
    }
}

internal sealed class TillAdjustStockHandler(InventoryDbContext db)
    : ICommandHandler<TillAdjustStockCommand, TillStockAdjustmentDto>
{
    private static readonly string[] Types = ["Purchase", "Sale", "Return", "Damage", "StockTake", "Opening", "Transfer"];

    public async Task<Result<TillStockAdjustmentDto>> Handle(TillAdjustStockCommand cmd, CancellationToken ct)
    {
        var product = await db.Products.FirstOrDefaultAsync(p => p.Id == cmd.ProductId, ct);
        if (product is null) return Result.Failure<TillStockAdjustmentDto>(Error.NotFoundById("Product", cmd.ProductId));

        var type = Types.FirstOrDefault(t => t.Equals(cmd.AdjustmentType?.Trim(), StringComparison.OrdinalIgnoreCase));
        if (type is null)
            return Result.Failure<TillStockAdjustmentDto>(Error.Custom("Stock.InvalidType", $"Invalid adjustment type '{cmd.AdjustmentType}'."));

        // A product that does not track stock has nothing to adjust — the till treats that as a no-op.
        if (!product.TrackInventory)
            return Result.Success(new TillStockAdjustmentDto(
                Guid.NewGuid(), product.Id, product.Name, type, cmd.Quantity, product.StockQuantity,
                cmd.Reference, DateTime.UtcNow, cmd.Notes));

        // The warehouse that holds this stock: the branch's own, else the workspace's default.
        Guid? warehouseId = null;
        if (cmd.BranchId is Guid branchId)
            warehouseId = await db.Warehouses.Where(w => w.BranchId == branchId)
                .OrderByDescending(w => w.IsDefault).ThenBy(w => w.CreatedAt).Select(w => (Guid?)w.Id).FirstOrDefaultAsync(ct);
        if (warehouseId is null && cmd.BranchId is null)
            warehouseId = await db.Warehouses.OrderByDescending(w => w.IsDefault).ThenBy(w => w.CreatedAt)
                .Select(w => (Guid?)w.Id).FirstOrDefaultAsync(ct);

        // Head-office stock cannot go below zero. (A branch's own bucket never has: it clamps at zero.)
        if (cmd.BranchId is null && product.StockQuantity + cmd.Quantity < 0)
            return Result.Failure<TillStockAdjustmentDto>(Error.Custom("Product.InsufficientStock",
                $"Insufficient stock. Current: {product.StockQuantity}, Requested: {Math.Abs(cmd.Quantity)}."));

        // The type the stock card shows. A sign that disagrees with the type's usual direction is
        // recorded as a plain signed Adjustment, so the quantity is never reinterpreted.
        var (movement, quantity) = (type, cmd.Quantity) switch
        {
            ("Purchase", > 0) => (MovementTypes.Receipt,    cmd.Quantity),
            ("Return",   > 0) => (MovementTypes.Return,     cmd.Quantity),
            ("Sale",     < 0) => (MovementTypes.Sale,       Math.Abs(cmd.Quantity)),
            ("Damage",   < 0) => (MovementTypes.WriteOff,   Math.Abs(cmd.Quantity)),
            _                 => (MovementTypes.Adjustment, cmd.Quantity),
        };
        var note = string.IsNullOrWhiteSpace(cmd.Notes) ? $"[{type}]" : $"[{type}] {cmd.Notes.Trim()}";

        product.AdjustStock(cmd.Quantity);
        decimal balance = product.StockQuantity;
        if (warehouseId is Guid wh)
        {
            var bucket = await db.ProductStocks.FirstOrDefaultAsync(s => s.ProductId == product.Id && s.WarehouseId == wh, ct);
            if (bucket is null) { bucket = new ProductStock(product.Id, wh); db.ProductStocks.Add(bucket); }
            bucket.Adjust(cmd.Quantity);
            if (cmd.BranchId is not null) balance = bucket.Quantity;   // a branch sees its own figure
        }

        var row = new StockMovement(product.Id, movement, quantity, product.CostPrice, cmd.Reference, note, warehouseId?.ToString());
        db.StockMovements.Add(row);
        await db.SaveChangesAsync(ct);

        return Result.Success(new TillStockAdjustmentDto(
            row.Id, product.Id, product.Name, type, cmd.Quantity, balance, row.Reference, row.CreatedAt, cmd.Notes));
    }
}

internal sealed class TillImportProductsHandler(InventoryDbContext db)
    : ICommandHandler<TillImportProductsCommand, TillImportResultDto>
{
    private const int SaveEvery = 500;

    public async Task<Result<TillImportResultDto>> Handle(TillImportProductsCommand cmd, CancellationToken ct)
    {
        // One read of the workspace's barcodes and categories instead of a lookup per row.
        var taken = (await db.Products.Where(p => p.Barcode != null).Select(p => p.Barcode!).ToListAsync(ct))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var categories = (await db.ProductCategories.Select(c => new { c.Id, c.Name }).ToListAsync(ct))
            .GroupBy(c => c.Name, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First().Id, StringComparer.OrdinalIgnoreCase);

        int imported = 0, existing = 0, invalid = 0, created = 0, pending = 0;

        foreach (var row in cmd.Rows)
        {
            var barcode = row.Barcode?.Trim() ?? "";
            if (barcode.Length is 0 or > TillCatalogueSupport.MaxBarcodeLength || string.IsNullOrWhiteSpace(row.Name)) { invalid++; continue; }
            if (!taken.Add(barcode)) { existing++; continue; }

            if (!categories.TryGetValue(row.Category, out var categoryId))
            {
                if (string.IsNullOrWhiteSpace(row.Category)) { invalid++; continue; }
                var made = new ProductCategory(row.Category, null, null, null);
                db.ProductCategories.Add(made);
                categoryId = made.Id;
                categories[row.Category] = categoryId;
                created++;
            }

            db.Products.Add(new Product(
                row.Name, null, null, barcode, categoryId, null, null,
                0, 0, cmd.TaxRate, "pcs", 0, 0, cmd.TrackInventory, null));
            imported++;

            // Big packs (UAE is ~9k rows) are saved in slices so one failure isn't a giant rollback
            // and the change tracker stays small.
            if (++pending >= SaveEvery) { await db.SaveChangesAsync(ct); db.ChangeTracker.Clear(); pending = 0; }
        }
        if (pending > 0) await db.SaveChangesAsync(ct);

        return Result.Success(new TillImportResultDto(imported, existing, invalid, created));
    }
}
