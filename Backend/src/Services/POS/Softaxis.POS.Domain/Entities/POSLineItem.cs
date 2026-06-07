using Softaxis.BuildingBlocks.Domain.Primitives;
using Softaxis.BuildingBlocks.Domain.Results;

namespace Softaxis.POS.Domain.Entities;

public sealed class POSLineItem : Entity<Guid>
{
    public Guid    TransactionId   { get; private set; }
    public Guid    ProductId       { get; private set; }
    public string  ProductName     { get; private set; } = default!;   // snapshot at time of sale
    public string? ProductSKU      { get; private set; }
    public string? ProductBarcode  { get; private set; }
    public decimal UnitPrice       { get; private set; }
    public decimal Quantity        { get; private set; }
    public decimal DiscountAmount  { get; private set; }
    public decimal DiscountPercent { get; private set; }
    public decimal TaxRate         { get; private set; }
    public decimal TaxAmount       { get; private set; }
    public decimal LineTotal       { get; private set; }  // (UnitPrice * Qty - Discount) + Tax
    public string  Unit            { get; private set; } = "pcs";
    public string? Notes           { get; private set; }

    // Navigation
    public POSTransaction Transaction { get; private set; } = default!;
    public Product         Product    { get; private set; } = default!;

    private POSLineItem() { }

    public static Result<POSLineItem> Create(
        Guid transactionId,
        Product product,
        decimal quantity,
        decimal? unitPriceOverride = null,
        decimal discountPercent = 0,
        decimal discountAmount = 0)
    {
        if (quantity <= 0)
            return Result.Failure<POSLineItem>(Error.Custom("LineItem.InvalidQty", "Quantity must be greater than zero."));

        if (discountPercent < 0 || discountPercent > 100)
            return Result.Failure<POSLineItem>(Error.Custom("LineItem.InvalidDiscount", "Discount percent must be between 0 and 100."));

        var unitPrice = unitPriceOverride ?? product.SalePrice;

        // Resolve discount
        decimal resolvedDiscount;
        if (discountPercent > 0)
            resolvedDiscount = Math.Round(unitPrice * quantity * (discountPercent / 100m), 2);
        else
            resolvedDiscount = Math.Round(discountAmount, 2);

        var subtotal  = Math.Round(unitPrice * quantity, 2) - resolvedDiscount;
        var taxAmount = Math.Round(subtotal * (product.TaxRate / 100m), 2);
        var lineTotal = subtotal + taxAmount;

        return Result.Success(new POSLineItem
        {
            Id             = Guid.NewGuid(),
            TransactionId  = transactionId,
            ProductId      = product.Id,
            ProductName    = product.Name,
            ProductSKU     = product.SKU,
            ProductBarcode = product.Barcode?.Value,
            UnitPrice      = unitPrice,
            Quantity       = quantity,
            DiscountPercent = discountPercent,
            DiscountAmount = resolvedDiscount,
            TaxRate        = product.TaxRate,
            TaxAmount      = taxAmount,
            LineTotal      = lineTotal,
            Unit           = product.Unit
        });
    }

    public decimal SubTotal => Math.Round(UnitPrice * Quantity - DiscountAmount, 2);

    /// <summary>
    /// Overload that accepts raw field values instead of a <see cref="Product"/> entity.
    /// Used when the product originates from a different schema (e.g. inventory.products)
    /// and is not tracked by the POS EF context.
    /// </summary>
    public static Result<POSLineItem> Create(
        Guid    transactionId,
        Guid    productId,
        string  productName,
        string? productSKU,
        string? productBarcode,
        decimal salePrice,
        decimal taxRate,
        string  unit,
        decimal quantity,
        decimal? unitPriceOverride  = null,
        decimal  discountPercent    = 0,
        decimal  discountAmount     = 0)
    {
        if (quantity <= 0)
            return Result.Failure<POSLineItem>(Error.Custom("LineItem.InvalidQty", "Quantity must be greater than zero."));

        if (discountPercent < 0 || discountPercent > 100)
            return Result.Failure<POSLineItem>(Error.Custom("LineItem.InvalidDiscount", "Discount percent must be between 0 and 100."));

        var unitPrice = unitPriceOverride ?? salePrice;

        decimal resolvedDiscount;
        if (discountPercent > 0)
            resolvedDiscount = Math.Round(unitPrice * quantity * (discountPercent / 100m), 2);
        else
            resolvedDiscount = Math.Round(discountAmount, 2);

        var subtotal  = Math.Round(unitPrice * quantity, 2) - resolvedDiscount;
        var taxAmount = Math.Round(subtotal * (taxRate / 100m), 2);
        var lineTotal = subtotal + taxAmount;

        return Result.Success(new POSLineItem
        {
            Id             = Guid.NewGuid(),
            TransactionId  = transactionId,
            ProductId      = productId,
            ProductName    = productName,
            ProductSKU     = productSKU,
            ProductBarcode = productBarcode,
            UnitPrice      = unitPrice,
            Quantity       = quantity,
            DiscountPercent = discountPercent,
            DiscountAmount = resolvedDiscount,
            TaxRate        = taxRate,
            TaxAmount      = taxAmount,
            LineTotal      = lineTotal,
            Unit           = unit
        });
    }
}
