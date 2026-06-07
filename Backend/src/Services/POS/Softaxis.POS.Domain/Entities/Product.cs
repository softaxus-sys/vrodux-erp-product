using Softaxis.BuildingBlocks.Domain.Primitives;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Domain.Enums;
using Softaxis.POS.Domain.Events;
using Softaxis.POS.Domain.ValueObjects;

namespace Softaxis.POS.Domain.Entities;

public sealed class Product : AuditableEntity<Guid>
{
    public string   Name           { get; private set; } = default!;
    public string?  Description    { get; private set; }
    public string?  SKU            { get; private set; }
    public Barcode? Barcode        { get; private set; }
    public Guid     CategoryId     { get; private set; }
    public decimal  SalePrice      { get; private set; }
    public decimal  CostPrice      { get; private set; }
    public decimal  TaxRate        { get; private set; }   // percentage, e.g. 17 for 17%
    public string   Unit           { get; private set; } = "pcs";
    public decimal  StockQuantity  { get; private set; }
    public decimal  ReorderLevel   { get; private set; }
    public bool     IsActive       { get; private set; }
    public bool     TrackInventory { get; private set; }
    public string?  ImageUrl       { get; private set; }

    // Navigation
    public ProductCategory             Category  { get; private set; } = default!;
    public ICollection<POSLineItem>    LineItems { get; private set; } = [];
    public ICollection<StockMovement>  Movements { get; private set; } = [];

    private Product() { }

    public static Result<Product> Create(
        string name,
        string? description,
        string? sku,
        string? barcode,
        Guid categoryId,
        decimal salePrice,
        decimal costPrice,
        decimal taxRate,
        string unit,
        decimal openingStock,
        decimal reorderLevel,
        bool trackInventory,
        string? imageUrl)
    {
        if (string.IsNullOrWhiteSpace(name))
            return Result.Failure<Product>(Error.Custom("Product.NameRequired", "Product name is required."));

        if (salePrice < 0)
            return Result.Failure<Product>(Error.Custom("Product.InvalidPrice", "Sale price cannot be negative."));

        if (costPrice < 0)
            return Result.Failure<Product>(Error.Custom("Product.InvalidCostPrice", "Cost price cannot be negative."));

        if (taxRate < 0 || taxRate > 100)
            return Result.Failure<Product>(Error.Custom("Product.InvalidTaxRate", "Tax rate must be between 0 and 100."));

        Barcode? barcodeVo = null;
        if (!string.IsNullOrWhiteSpace(barcode))
        {
            var barcodeResult = ValueObjects.Barcode.Create(barcode);
            if (barcodeResult.IsFailure)
                return Result.Failure<Product>(barcodeResult.Error);
            barcodeVo = barcodeResult.Value;
        }

        var product = new Product
        {
            Id             = Guid.NewGuid(),
            Name           = name.Trim(),
            Description    = description?.Trim(),
            SKU            = sku?.Trim().ToUpperInvariant(),
            Barcode        = barcodeVo,
            CategoryId     = categoryId,
            SalePrice      = Math.Round(salePrice, 2),
            CostPrice      = Math.Round(costPrice, 2),
            TaxRate        = Math.Round(taxRate, 2),
            Unit           = string.IsNullOrWhiteSpace(unit) ? "pcs" : unit.Trim(),
            StockQuantity  = openingStock,
            ReorderLevel   = reorderLevel,
            TrackInventory = trackInventory,
            IsActive       = true,
            ImageUrl       = imageUrl?.Trim()
        };

        product.RaiseDomainEvent(new ProductCreatedEvent(product.Id, product.Name, openingStock));

        return Result.Success(product);
    }

    public Result Update(
        string name, string? description, string? sku, string? barcode,
        Guid categoryId, decimal salePrice, decimal costPrice,
        decimal taxRate, string unit, decimal reorderLevel,
        bool trackInventory, string? imageUrl)
    {
        if (string.IsNullOrWhiteSpace(name))
            return Result.Failure(Error.Custom("Product.NameRequired", "Product name is required."));

        if (salePrice < 0 || costPrice < 0)
            return Result.Failure(Error.Custom("Product.InvalidPrice", "Prices cannot be negative."));

        if (taxRate < 0 || taxRate > 100)
            return Result.Failure(Error.Custom("Product.InvalidTaxRate", "Tax rate must be between 0 and 100."));

        Barcode? barcodeVo = null;
        if (!string.IsNullOrWhiteSpace(barcode))
        {
            var barcodeResult = ValueObjects.Barcode.Create(barcode);
            if (barcodeResult.IsFailure)
                return Result.Failure(barcodeResult.Error);
            barcodeVo = barcodeResult.Value;
        }

        Name           = name.Trim();
        Description    = description?.Trim();
        SKU            = sku?.Trim().ToUpperInvariant();
        Barcode        = barcodeVo;
        CategoryId     = categoryId;
        SalePrice      = Math.Round(salePrice, 2);
        CostPrice      = Math.Round(costPrice, 2);
        TaxRate        = Math.Round(taxRate, 2);
        Unit           = string.IsNullOrWhiteSpace(unit) ? "pcs" : unit.Trim();
        ReorderLevel   = reorderLevel;
        TrackInventory = trackInventory;
        ImageUrl       = imageUrl?.Trim();

        return Result.Success();
    }

    public Result AdjustStock(decimal qty, StockAdjustmentType adjustmentType, string? reference = null)
    {
        if (!TrackInventory)
            return Result.Success(); // No-op for non-tracked products

        var newQty = StockQuantity + qty;
        if (newQty < 0)
            return Result.Failure(Error.Custom("Product.InsufficientStock",
                $"Insufficient stock. Current: {StockQuantity}, Requested: {Math.Abs(qty)}."));

        StockQuantity = newQty;

        RaiseDomainEvent(new StockAdjustedEvent(Id, Name, qty, StockQuantity, adjustmentType, reference));

        if (StockQuantity <= ReorderLevel && ReorderLevel > 0)
            RaiseDomainEvent(new LowStockAlertEvent(Id, Name, StockQuantity, ReorderLevel));

        return Result.Success();
    }

    public void Activate()   => IsActive = true;
    public void Deactivate() => IsActive = false;

    public bool IsLowStock => TrackInventory && StockQuantity <= ReorderLevel && ReorderLevel > 0;
}
