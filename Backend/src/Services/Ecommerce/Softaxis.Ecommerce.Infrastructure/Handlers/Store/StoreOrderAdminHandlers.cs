using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Ecommerce.Application.Abstractions;
using Softaxis.Ecommerce.Application.StoreAdmin;
using Softaxis.Ecommerce.Domain.Entities;
using Softaxis.Ecommerce.Infrastructure.Persistence;
using Softaxis.Ecommerce.Infrastructure.Services.Shop;

namespace Softaxis.Ecommerce.Infrastructure.Handlers.StoreAdmin;

internal static class StoreOrderMapping
{
    public static StoreOrderDto ToDto(StoreOrder o) => new(
        o.Id, o.Number, o.Status, o.PaymentMethod, o.PaymentStatus, o.Email, o.Phone, o.CustomerName,
        o.ShipName, o.ShipLine1, o.ShipLine2, o.ShipCity, o.ShipRegion, o.ShipPostal, o.ShipCountry,
        o.ShippingMethod, o.Subtotal, o.DiscountTotal, o.DiscountCode, o.ShippingTotal, o.TaxTotal, o.Total,
        o.CurrencyCode, o.PaymentReference, o.PaidAt, o.TrackingCarrier, o.TrackingNumber, o.TrackingUrl, o.ShippedAt, o.DeliveredAt,
        o.CancelledAt, o.CancelReason, o.CustomerNote, o.StaffNote, o.CreatedAt,
        o.Lines.Select(l => new StoreOrderLineDto(l.ProductId, l.Title, l.VariantName, l.Sku, l.Quantity, l.UnitPrice, l.LineTotal)).ToList(),
        o.Events.OrderBy(e => e.At).Select(e => new StoreOrderEventDto(e.Kind, e.Message, e.ByName, e.At)).ToList());

    public static IQueryable<StoreOrder> WithDetail(EcommerceDbContext db) =>
        db.StoreOrders.Include(o => o.Lines).Include(o => o.Events);

    public static Error NotFound => Error.Custom("Order.NotFound", "That order was not found.");
}

internal sealed class GetStoreOrdersHandler(EcommerceDbContext db) : IQueryHandler<GetStoreOrdersQuery, PagedResult<StoreOrderSummaryDto>>
{
    public async Task<Result<PagedResult<StoreOrderSummaryDto>>> Handle(GetStoreOrdersQuery q, CancellationToken ct)
    {
        var page = Math.Max(1, q.Page); var size = Math.Clamp(q.PageSize, 1, 100);
        var query = db.StoreOrders.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(q.Status)) query = query.Where(o => o.Status == q.Status);
        if (!string.IsNullOrWhiteSpace(q.PaymentStatus)) query = query.Where(o => o.PaymentStatus == q.PaymentStatus);
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim().TrimStart('#');
            query = query.Where(o => o.Number.Contains(s) || o.Email.Contains(s) || o.CustomerName.Contains(s) || (o.Phone != null && o.Phone.Contains(s)));
        }
        var total = await query.CountAsync(ct);
        var rows = await query.OrderByDescending(o => o.CreatedAt).Skip((page - 1) * size).Take(size)
            .Select(o => new StoreOrderSummaryDto(o.Id, o.Number, o.Status, o.PaymentMethod, o.PaymentStatus, o.CustomerName, o.Email,
                o.Total, o.CurrencyCode, o.Lines.Sum(l => l.Quantity), o.CreatedAt)).ToListAsync(ct);
        return Result.Success(PagedResult<StoreOrderSummaryDto>.Create(rows, total, page, size));
    }
}

internal sealed class GetStoreOrderHandler(EcommerceDbContext db) : IQueryHandler<GetStoreOrderQuery, StoreOrderDto>
{
    public async Task<Result<StoreOrderDto>> Handle(GetStoreOrderQuery q, CancellationToken ct)
    {
        var o = await StoreOrderMapping.WithDetail(db).AsNoTracking().FirstOrDefaultAsync(x => x.Id == q.Id, ct);
        return o is null ? Result.Failure<StoreOrderDto>(StoreOrderMapping.NotFound) : Result.Success(StoreOrderMapping.ToDto(o));
    }
}

internal sealed class GetStoreOrdersSummaryHandler(EcommerceDbContext db) : IQueryHandler<GetStoreOrdersSummaryQuery, StoreOrdersSummaryDto>
{
    public async Task<Result<StoreOrdersSummaryDto>> Handle(GetStoreOrdersSummaryQuery q, CancellationToken ct)
    {
        var since = DateTime.UtcNow.AddDays(-30);
        var currency = await db.Stores.AsNoTracking().Select(s => s.CurrencyCode).FirstOrDefaultAsync(ct) ?? "USD";
        var toFulfil = await db.StoreOrders.CountAsync(o => o.Status == StoreOrderStatuses.Placed, ct);
        var awaiting = await db.StoreOrders.CountAsync(o => o.Status == StoreOrderStatuses.AwaitingPayment, ct);
        var shipped = await db.StoreOrders.CountAsync(o => o.Status == StoreOrderStatuses.Shipped, ct);
        var recent = await db.StoreOrders.Where(o => o.CreatedAt >= since && o.Status != StoreOrderStatuses.Cancelled && o.Status != StoreOrderStatuses.AwaitingPayment)
            .Select(o => o.Total).ToListAsync(ct);
        return Result.Success(new StoreOrdersSummaryDto(toFulfil, awaiting, shipped, recent.Sum(), recent.Count, currency));
    }
}

/// <summary>Shared by the staff commands: load the order with everything, or say it is missing.</summary>
internal static class StoreOrderAccess
{
    public static Task<StoreOrder?> LoadAsync(EcommerceDbContext db, Guid id, CancellationToken ct) =>
        StoreOrderMapping.WithDetail(db).FirstOrDefaultAsync(o => o.Id == id, ct);

    public static async Task<Store?> StoreAsync(EcommerceDbContext db, CancellationToken ct) => await db.Stores.AsNoTracking().FirstOrDefaultAsync(ct);
}

internal sealed class MarkStoreOrderPaidHandler(EcommerceDbContext db, StoreOrderService orders, ICurrentStaff who)
    : ICommandHandler<MarkStoreOrderPaidCommand, StoreOrderDto>
{
    public async Task<Result<StoreOrderDto>> Handle(MarkStoreOrderPaidCommand c, CancellationToken ct)
    {
        var o = await StoreOrderAccess.LoadAsync(db, c.Id, ct);
        if (o is null) return Result.Failure<StoreOrderDto>(StoreOrderMapping.NotFound);
        var store = await StoreOrderAccess.StoreAsync(db, ct);
        if (store is null) return Result.Failure<StoreOrderDto>(StoreErrors.NoStore);
        if (o.Status == StoreOrderStatuses.Cancelled) return Result.Failure<StoreOrderDto>(ShopErrors.Conflict("A cancelled order cannot be marked paid."));
        if (o.PaymentStatus == StorePaymentStatuses.Paid) return Result.Success(StoreOrderMapping.ToDto(o));

        if (o.Status == StoreOrderStatuses.AwaitingPayment && !o.StockTaken && o.Lines.Any(l => l.TrackInventory))
            return Result.Failure<StoreOrderDto>(ShopErrors.Conflict("This order's stock was released. Cancel it and ask the customer to order again."));

        await orders.MarkPaidAsync(store, o, string.IsNullOrWhiteSpace(c.Reference) ? null : c.Reference.Trim(), who.Name, null, ct);
        return Result.Success(StoreOrderMapping.ToDto(o));
    }
}

internal sealed class ShipStoreOrderHandler(EcommerceDbContext db, StoreOrderService orders, ICurrentStaff who)
    : ICommandHandler<ShipStoreOrderCommand, StoreOrderDto>
{
    public async Task<Result<StoreOrderDto>> Handle(ShipStoreOrderCommand c, CancellationToken ct)
    {
        var o = await StoreOrderAccess.LoadAsync(db, c.Id, ct);
        if (o is null) return Result.Failure<StoreOrderDto>(StoreOrderMapping.NotFound);
        if (o.Status is not (StoreOrderStatuses.Placed or StoreOrderStatuses.Shipped))
            return Result.Failure<StoreOrderDto>(ShopErrors.Conflict(o.Status == StoreOrderStatuses.AwaitingPayment
                ? "This order has not been paid yet." : "This order can no longer be shipped."));
        if (!string.IsNullOrWhiteSpace(c.TrackingUrl)
            && !(Uri.TryCreate(c.TrackingUrl.Trim(), UriKind.Absolute, out var u) && (u.Scheme == Uri.UriSchemeHttps || u.Scheme == Uri.UriSchemeHttp)))
            return Result.Failure<StoreOrderDto>(StoreErrors.Invalid("The tracking link must start with http:// or https://."));

        var first = o.Status == StoreOrderStatuses.Placed;
        o.Status = StoreOrderStatuses.Shipped;
        o.ShippedAt ??= DateTime.UtcNow;
        o.TrackingCarrier = Clean(c.Carrier); o.TrackingNumber = Clean(c.TrackingNumber); o.TrackingUrl = Clean(c.TrackingUrl);
        o.AddEvent("shipped", first ? "Order shipped." : "Tracking updated.", who.Name);
        o.Touch();
        await db.SaveChangesAsync(ct);

        var store = await StoreOrderAccess.StoreAsync(db, ct);
        if (first && store is not null)
        {
            try { await orders.SendShippedEmailAsync(store, o, ct); } catch { /* the order is shipped regardless of the email */ }
        }
        return Result.Success(StoreOrderMapping.ToDto(o));
    }

    private static string? Clean(string? v) => string.IsNullOrWhiteSpace(v) ? null : v.Trim();
}

internal sealed class DeliverStoreOrderHandler(EcommerceDbContext db, ICurrentStaff who)
    : ICommandHandler<DeliverStoreOrderCommand, StoreOrderDto>
{
    public async Task<Result<StoreOrderDto>> Handle(DeliverStoreOrderCommand c, CancellationToken ct)
    {
        var o = await StoreOrderAccess.LoadAsync(db, c.Id, ct);
        if (o is null) return Result.Failure<StoreOrderDto>(StoreOrderMapping.NotFound);
        if (o.Status is not (StoreOrderStatuses.Placed or StoreOrderStatuses.Shipped))
            return Result.Failure<StoreOrderDto>(ShopErrors.Conflict("Only a shipped order can be marked delivered."));

        o.Status = StoreOrderStatuses.Delivered; o.DeliveredAt = DateTime.UtcNow; o.ShippedAt ??= o.DeliveredAt;
        // Cash on delivery is collected at the door, so delivering it is also receiving the money.
        if (o.PaymentMethod == PaymentMethods.Cod && o.PaymentStatus != StorePaymentStatuses.Paid)
        {
            o.PaymentStatus = StorePaymentStatuses.Paid; o.PaidAt = DateTime.UtcNow;
            o.AddEvent("payment", "Cash collected on delivery.", who.Name);
        }
        o.AddEvent("delivered", "Order delivered.", who.Name);
        o.Touch();
        await db.SaveChangesAsync(ct);
        return Result.Success(StoreOrderMapping.ToDto(o));
    }
}

internal sealed class CancelStoreOrderHandler(EcommerceDbContext db, StoreOrderService orders, ICurrentStaff who)
    : ICommandHandler<CancelStoreOrderCommand, StoreOrderDto>
{
    public async Task<Result<StoreOrderDto>> Handle(CancelStoreOrderCommand c, CancellationToken ct)
    {
        var o = await StoreOrderAccess.LoadAsync(db, c.Id, ct);
        if (o is null) return Result.Failure<StoreOrderDto>(StoreOrderMapping.NotFound);
        var store = await StoreOrderAccess.StoreAsync(db, ct);
        if (store is null) return Result.Failure<StoreOrderDto>(StoreErrors.NoStore);
        if (o.Status is StoreOrderStatuses.Cancelled or StoreOrderStatuses.Delivered)
            return Result.Failure<StoreOrderDto>(ShopErrors.Conflict("This order can no longer be cancelled."));
        if (o.PaymentStatus == StorePaymentStatuses.Paid && o.PaymentMethod is PaymentMethods.Stripe or PaymentMethods.PayPal)
            return Result.Failure<StoreOrderDto>(ShopErrors.Conflict("This order was paid online. Refund it instead, which also cancels it."));

        await orders.CancelAsync(store, o, string.IsNullOrWhiteSpace(c.Reason) ? "Cancelled by the store." : c.Reason.Trim(), who.Name, ct);
        return Result.Success(StoreOrderMapping.ToDto(o));
    }
}

internal sealed class RefundStoreOrderHandler(
    EcommerceDbContext db, StoreOrderService orders, StripeGateway stripe, PayPalGateway paypal, ISecretProtector protector,
    ICurrentStaff who)
    : ICommandHandler<RefundStoreOrderCommand, StoreOrderDto>
{
    public async Task<Result<StoreOrderDto>> Handle(RefundStoreOrderCommand c, CancellationToken ct)
    {
        var o = await StoreOrderAccess.LoadAsync(db, c.Id, ct);
        if (o is null) return Result.Failure<StoreOrderDto>(StoreOrderMapping.NotFound);
        var store = await StoreOrderAccess.StoreAsync(db, ct);
        if (store is null) return Result.Failure<StoreOrderDto>(StoreErrors.NoStore);
        if (o.PaymentStatus != StorePaymentStatuses.Paid)
            return Result.Failure<StoreOrderDto>(ShopErrors.Conflict("Only a paid order can be refunded."));

        var by = who.Name;
        // The money goes back first. If the provider refuses, nothing here changes, so the order never says "refunded" for money still held.
        try
        {
            if (o.PaymentMethod == PaymentMethods.Stripe)
            {
                var key = store.StripeSecretEnc is null ? null : protector.Unprotect(store.StripeSecretEnc);
                if (key is null || string.IsNullOrEmpty(o.PaymentReference))
                    return Result.Failure<StoreOrderDto>(ShopErrors.Conflict("The card payment details are missing. Refund it in your Stripe dashboard, then cancel the order here."));
                await stripe.RefundAsync(key, o.PaymentReference, ct);
            }
            else if (o.PaymentMethod == PaymentMethods.PayPal)
            {
                var secret = store.PayPalSecretEnc is null ? null : protector.Unprotect(store.PayPalSecretEnc);
                if (secret is null || store.PayPalClientId is null || string.IsNullOrEmpty(o.PaymentReference))
                    return Result.Failure<StoreOrderDto>(ShopErrors.Conflict("The PayPal payment details are missing. Refund it in PayPal, then cancel the order here."));
                await paypal.RefundAsync(store.PayPalClientId, secret, store.PayPalSandbox, o.PaymentReference, ct);
            }
        }
        catch (PaymentException ex) { return Result.Failure<StoreOrderDto>(Error.Custom("Order.Unavailable", ex.Message)); }

        o.PaymentStatus = StorePaymentStatuses.Refunded;
        o.AddEvent("refund", string.IsNullOrWhiteSpace(c.Reason) ? "Payment refunded." : $"Payment refunded: {c.Reason.Trim()}", by);
        if (o.Status is not (StoreOrderStatuses.Cancelled or StoreOrderStatuses.Delivered))
            await orders.CancelAsync(store, o, string.IsNullOrWhiteSpace(c.Reason) ? "Refunded." : c.Reason.Trim(), by, ct);
        else { o.Touch(); await db.SaveChangesAsync(ct); }
        return Result.Success(StoreOrderMapping.ToDto(o));
    }
}

internal sealed class SetStoreOrderNoteHandler(EcommerceDbContext db) : ICommandHandler<SetStoreOrderNoteCommand, StoreOrderDto>
{
    public async Task<Result<StoreOrderDto>> Handle(SetStoreOrderNoteCommand c, CancellationToken ct)
    {
        var o = await StoreOrderAccess.LoadAsync(db, c.Id, ct);
        if (o is null) return Result.Failure<StoreOrderDto>(StoreOrderMapping.NotFound);
        var note = string.IsNullOrWhiteSpace(c.Note) ? null : c.Note.Trim();
        o.StaffNote = note is { Length: > 2000 } ? note[..2000] : note;
        o.Touch();
        await db.SaveChangesAsync(ct);
        return Result.Success(StoreOrderMapping.ToDto(o));
    }
}

internal sealed class GetStoreCustomersHandler(EcommerceDbContext db) : IQueryHandler<GetStoreCustomersQuery, PagedResult<StoreCustomerDto>>
{
    public async Task<Result<PagedResult<StoreCustomerDto>>> Handle(GetStoreCustomersQuery q, CancellationToken ct)
    {
        var page = Math.Max(1, q.Page); var size = Math.Clamp(q.PageSize, 1, 100);
        var query = db.Customers.AsNoTracking().Where(c => !c.IsDeleted);
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim();
            query = query.Where(c => c.Email.Contains(s) || c.FirstName.Contains(s) || c.LastName.Contains(s) || (c.Phone != null && c.Phone.Contains(s)));
        }
        var total = await query.CountAsync(ct);
        var rows = await query.OrderByDescending(c => c.CreatedAt).Skip((page - 1) * size).Take(size).ToListAsync(ct);
        var ids = rows.Select(r => r.Id).ToList();
        var stats = await db.StoreOrders.AsNoTracking()
            .Where(o => o.CustomerId != null && ids.Contains(o.CustomerId.Value) && o.Status != StoreOrderStatuses.Cancelled)
            .GroupBy(o => o.CustomerId!.Value).Select(g => new { Id = g.Key, N = g.Count(), Sum = g.Sum(o => o.Total) }).ToListAsync(ct);
        var items = rows.Select(r =>
        {
            var st = stats.FirstOrDefault(x => x.Id == r.Id);
            return new StoreCustomerDto(r.Id, r.Email, r.FullName, r.Phone, r.AcceptsMarketing, st?.N ?? 0, st?.Sum ?? 0, r.CreatedAt, r.LastSignInAt);
        }).ToList();
        return Result.Success(PagedResult<StoreCustomerDto>.Create(items, total, page, size));
    }
}
