using Microsoft.Extensions.Options;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.Abstractions;
using Softaxis.POS.Application.Common;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.Transactions.Commands.CreateSale;

public sealed class CreateSaleCommandHandler(
    IPOSSessionRepository      sessionRepo,
    IPOSTransactionRepository  txnRepo,
    ICrossSchemaProductService productLookup,
    ICustomerRepository        customerRepo,
    IVoucherRepository         voucherRepo,
    ICurrentUser               currentUser,
    IOptions<DiscountSettings> discountOpts,
    IUnitOfWork                uow)
    : ICommandHandler<CreateSaleCommand, POSTransactionDto>
{
    private readonly DiscountSettings _settings = discountOpts.Value;

    // Per-line working data captured in pass 1
    private sealed record LineDraft(
        LineItemRequest    Req,
        ProductSaleView    Product,
        decimal            UnitPrice,
        decimal            PerLineDiscount,   // absolute, from per-line discount fields
        decimal            BaseSubtotal);     // unitPrice*qty - perLineDiscount

    public async Task<Result<POSTransactionDto>> Handle(CreateSaleCommand cmd, CancellationToken ct)
    {
        // ── Validate session ─────────────────────────────────────────────────
        var session = await sessionRepo.GetByIdAsync(cmd.SessionId, ct);
        if (session is null)
            return Result.Failure<POSTransactionDto>(Error.NotFoundById("Session", cmd.SessionId));

        if (session.Status != Domain.Enums.SessionStatus.Open)
            return Result.Failure<POSTransactionDto>(Error.Custom("Session.NotOpen",
                "Transactions can only be created in an open session."));

        // ── Optional customer ────────────────────────────────────────────────
        Customer? customer = null;
        if (cmd.CustomerId.HasValue)
        {
            customer = await customerRepo.GetByIdAsync(cmd.CustomerId.Value, ct);
            if (customer is null)
                return Result.Failure<POSTransactionDto>(Error.NotFoundById("Customer", cmd.CustomerId.Value));
        }

        // ── Pass 1: resolve products, compute per-line base subtotals ─────────
        var drafts = new List<LineDraft>();
        foreach (var req in cmd.LineItems)
        {
            var product = await productLookup.GetByIdForSaleAsync(req.ProductId, ct);
            if (product is null)
                return Result.Failure<POSTransactionDto>(Error.NotFoundById("Product", req.ProductId));

            if (!product.IsActive)
                return Result.Failure<POSTransactionDto>(Error.Custom("Product.Inactive",
                    $"Product '{product.Name}' is not available for sale."));

            if (product.TrackInventory && product.StockQuantity < req.Quantity)
                return Result.Failure<POSTransactionDto>(Error.Custom("Product.InsufficientStock",
                    $"Insufficient stock for '{product.Name}'. Available: {product.StockQuantity}."));

            var unitPrice = req.UnitPriceOverride ?? product.SalePrice;
            var lineGross = Math.Round(unitPrice * req.Quantity, 2);
            var perLine   = req.DiscountPercent > 0
                ? Math.Round(lineGross * (req.DiscountPercent / 100m), 2)
                : Math.Round(req.DiscountAmount, 2);
            perLine = Math.Min(perLine, lineGross);

            drafts.Add(new LineDraft(req, product, unitPrice, perLine, lineGross - perLine));
        }

        var grossSubtotal = drafts.Sum(d => d.BaseSubtotal);

        // ── Resolve order-level discount (authoritative, server-side) ─────────
        var discountResult = await ResolveOrderDiscount(cmd.OrderDiscount, grossSubtotal, customer, ct);
        if (discountResult.IsFailure)
            return Result.Failure<POSTransactionDto>(discountResult.Error);

        var (orderDiscount, discountType, discountReference) = discountResult.Value;

        // ── Pass 2: build line items, distributing the order discount ─────────
        var txnNumber = await txnRepo.GenerateTransactionNumberAsync(ct);
        var txnResult = POSTransaction.CreateSale(
            txnNumber, cmd.SessionId, currentUser.Id ?? session.CashierId, cmd.CustomerId);
        if (txnResult.IsFailure)
            return Result.Failure<POSTransactionDto>(txnResult.Error);
        var transaction = txnResult.Value;

        var lineItems    = new List<POSLineItem>();
        var allocated    = 0m;
        for (var i = 0; i < drafts.Count; i++)
        {
            var d = drafts[i];

            // Proportional share of the order discount; last line absorbs rounding remainder
            decimal share = 0m;
            if (orderDiscount > 0 && grossSubtotal > 0)
            {
                share = i == drafts.Count - 1
                    ? orderDiscount - allocated
                    : Math.Round(orderDiscount * (d.BaseSubtotal / grossSubtotal), 2);
                allocated += share;
            }

            var lineDiscount = d.PerLineDiscount + share;

            var lineResult = POSLineItem.Create(
                transaction.Id,
                d.Product.Id, d.Product.Name, d.Product.SKU, d.Product.Barcode,
                d.UnitPrice, d.Product.TaxRate, d.Product.Unit,
                d.Req.Quantity,
                unitPriceOverride: d.Req.UnitPriceOverride,
                discountPercent: 0,
                discountAmount: lineDiscount);

            if (lineResult.IsFailure)
                return Result.Failure<POSTransactionDto>(lineResult.Error);

            lineItems.Add(lineResult.Value);
        }

        // ── Payments ──────────────────────────────────────────────────────────
        var payments = new List<POSPayment>();
        foreach (var req in cmd.Payments)
        {
            var method = PaymentMethodCodeResolver.Resolve(req.Method);
            if (method is null)
                return Result.Failure<POSTransactionDto>(Error.Custom("Payment.InvalidMethod",
                    $"Invalid payment method '{req.Method}'."));

            var payResult = POSPayment.Create(transaction.Id, method.Value, req.Amount, req.Reference);
            if (payResult.IsFailure)
                return Result.Failure<POSTransactionDto>(payResult.Error);

            payments.Add(payResult.Value);
        }

        // ── Validate sufficient payment ───────────────────────────────────────
        var totalAmount = lineItems.Sum(i => i.LineTotal);
        var totalPaid   = payments.Sum(p => p.Amount);
        // Allow a 1-cent tolerance: the frontend computes its displayed total via
        // continuous (unrounded) per-item tax shares, which can differ from the
        // backend's per-line-rounded total by up to a cent.
        if (totalPaid < totalAmount - 0.01m)
            return Result.Failure<POSTransactionDto>(Error.Custom("Sale.Underpaid",
                $"Payment amount ({totalPaid:F2}) is less than total ({totalAmount:F2})."));

        // ── Complete ──────────────────────────────────────────────────────────
        transaction.SetOrderDiscount(discountType, discountReference);
        var completeResult = transaction.Complete(lineItems, payments, cmd.Notes);
        if (completeResult.IsFailure)
            return Result.Failure<POSTransactionDto>(completeResult.Error);

        // ── Deduct stock in the correct schema (pos or inventory) ─────────────
        foreach (var d in drafts)
            await productLookup.DeductStockAsync(
                d.Product, d.Req.Quantity, txnNumber,
                currentUser.Id ?? session.CashierId, transaction.Id, ct);

        // ── Update session totals ─────────────────────────────────────────────
        session.RecordTransaction(transaction.TotalAmount, isRefund: false);

        // ── Customer loyalty: earn 1 point per 100 spent ─────────────────────
        if (customer is not null)
        {
            customer.RecordPurchase(transaction.TotalAmount);
            customer.AddLoyaltyPoints(Math.Floor(transaction.TotalAmount / 100));
            customerRepo.Update(customer);
        }

        txnRepo.Add(transaction);
        sessionRepo.Update(session);
        await uow.SaveChangesAsync(ct);

        return Result.Success(MapToDto(transaction, customer?.Name));
    }

    /// <summary>
    /// Resolve the order-level discount to a concrete amount, validating server-side
    /// and applying side effects (voucher usage increment, loyalty redemption).
    /// Returns (amount, type, reference).
    /// </summary>
    private async Task<Result<(decimal Amount, string Type, string? Reference)>> ResolveOrderDiscount(
        OrderDiscountRequest? od, decimal grossSubtotal, Customer? customer, CancellationToken ct)
    {
        if (od is null || od.Type is "none" || grossSubtotal <= 0)
            return Result.Success<(decimal, string, string?)>((0m, "none", null));

        switch (od.Type)
        {
            case "percentage":
            {
                var pct = od.Value ?? 0m;
                if (pct > _settings.MaxDiscountPercent)
                    return Result.Failure<(decimal, string, string?)>(Error.Custom("Discount.ExceedsMax",
                        $"Discount cannot exceed {_settings.MaxDiscountPercent}%."));
                var amount = Math.Round(grossSubtotal * (pct / 100m), 2);
                return Result.Success<(decimal, string, string?)>((amount, "percentage", $"{pct:0.##}%"));
            }
            case "fixed":
            {
                var amt    = od.Value ?? 0m;
                var maxAmt = Math.Round(grossSubtotal * (_settings.MaxDiscountPercent / 100m), 2);
                if (amt > maxAmt)
                    return Result.Failure<(decimal, string, string?)>(Error.Custom("Discount.ExceedsMax",
                        $"Discount cannot exceed {_settings.MaxDiscountPercent}% of the subtotal."));
                return Result.Success<(decimal, string, string?)>((Math.Min(amt, grossSubtotal), "fixed", null));
            }
            case "voucher":
            {
                var voucher = await voucherRepo.GetByCodeAsync(od.VoucherCode ?? "", ct);
                if (voucher is null)
                    return Result.Failure<(decimal, string, string?)>(
                        Error.Custom("Voucher.NotFound", "Voucher code not found."));

                var check = voucher.Validate(grossSubtotal, DateTime.UtcNow);
                if (check.IsFailure)
                    return Result.Failure<(decimal, string, string?)>(check.Error);

                var amount = voucher.ComputeDiscount(grossSubtotal);
                voucher.IncrementUsage();
                voucherRepo.Update(voucher);
                return Result.Success<(decimal, string, string?)>((amount, "voucher", voucher.Code));
            }
            case "loyalty":
            {
                if (customer is null)
                    return Result.Failure<(decimal, string, string?)>(Error.Custom("Discount.NoCustomer",
                        "A customer must be selected to redeem loyalty points."));

                var requested = Math.Floor(od.LoyaltyPoints ?? 0m);
                if (requested <= 0)
                    return Result.Failure<(decimal, string, string?)>(Error.Custom("Discount.InvalidPoints",
                        "Loyalty points to redeem must be greater than zero."));

                // Cap points so the discount never exceeds the subtotal
                var pointValue = _settings.LoyaltyPointValue <= 0 ? 1m : _settings.LoyaltyPointValue;
                var maxPointsByValue = Math.Floor(grossSubtotal / pointValue);
                var points = Math.Min(requested, maxPointsByValue);
                if (points <= 0)
                    return Result.Failure<(decimal, string, string?)>(Error.Custom("Discount.InvalidPoints",
                        "Redeemable points amount is too small for this cart."));

                var redeem = customer.RedeemLoyaltyPoints(points);
                if (redeem.IsFailure)
                    return Result.Failure<(decimal, string, string?)>(redeem.Error);

                var amount = Math.Round(points * pointValue, 2);
                return Result.Success<(decimal, string, string?)>((amount, "loyalty", $"POINTS:{points:0}"));
            }
            default:
                return Result.Failure<(decimal, string, string?)>(Error.Custom("Discount.InvalidType",
                    $"Unknown discount type '{od.Type}'."));
        }
    }

    private static POSTransactionDto MapToDto(POSTransaction t, string? customerName) =>
        new(t.Id, t.TransactionNumber, t.SessionId, t.CashierId, t.CustomerId, customerName,
            t.Type.ToString(), t.Status.ToString(), t.OriginalTxnId,
            t.SubTotal, t.TaxAmount, t.DiscountAmount, t.TotalAmount,
            t.AmountPaid, t.ChangeGiven, t.Notes, t.CompletedAt,
            t.LineItems.Select(i => new POSLineItemDto(
                i.Id, i.ProductId, i.ProductName, i.ProductSKU, i.ProductBarcode,
                i.UnitPrice, i.Quantity, i.DiscountPercent, i.DiscountAmount,
                i.TaxRate, i.TaxAmount, i.LineTotal, i.Unit)).ToList(),
            t.Payments.Select(p => new POSPaymentDto(
                p.Id, p.Method.ToString(), p.Amount, p.Reference)).ToList());
}
