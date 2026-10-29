using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.Notifications;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Ecommerce.Application.Abstractions;
using Softaxis.Ecommerce.Application.Shop;
using Softaxis.Ecommerce.Domain.Entities;
using Softaxis.Ecommerce.Infrastructure.Persistence;
using Softaxis.Inventory.Application.Storefront;

namespace Softaxis.Ecommerce.Infrastructure.Services.Shop;

/// <summary>Where the shopper's browser should return to, and the links emails carry. Only addresses that belong to the store are ever used.</summary>
internal sealed class ShopLinks(IConfiguration configuration)
{
    /// <summary>
    /// The origin the shopper is on, if it is one of this store's own addresses; otherwise the platform's front end. The
    /// requested origin comes from the browser, so it is checked against the store's known hosts rather than trusted —
    /// otherwise a crafted request could make a payment provider send the shopper to any site.
    /// </summary>
    public (string Origin, bool OnStoreHost) Resolve(Store store, string? requestedOrigin)
    {
        if (Uri.TryCreate(requestedOrigin, UriKind.Absolute, out var u) && (u.Scheme == Uri.UriSchemeHttps || u.Scheme == Uri.UriSchemeHttp))
        {
            var host = u.Host.ToLowerInvariant();
            if (!string.IsNullOrEmpty(store.CustomDomain) && host == store.CustomDomain)
                return (u.GetLeftPart(UriPartial.Authority), true);
            foreach (var b in BaseDomains())
                if (host == $"{store.Slug}.{b}") return (u.GetLeftPart(UriPartial.Authority), true);
            var front = FrontOrigin();
            if (front is not null && Uri.TryCreate(front, UriKind.Absolute, out var f) && string.Equals(f.Host, u.Host, StringComparison.OrdinalIgnoreCase)
                && f.Port == u.Port)
                return (front, false);
        }
        return (FrontOrigin() ?? "http://localhost:5173", false);
    }

    public string ShopUrl(Store store, string? requestedOrigin, string path = "")
    {
        var (origin, onHost) = Resolve(store, requestedOrigin);
        var prefix = onHost ? "" : $"/shop/{store.Slug}";
        return origin.TrimEnd('/') + prefix + path;
    }

    /// <summary>An address on the API host (webhook URLs shown to the owner). Same host as the front end unless Ecommerce:PublicApiUrl says otherwise.</summary>
    public string ApiUrl(string path) => ((configuration["Ecommerce:PublicApiUrl"] ?? FrontOrigin()) ?? "http://localhost:5000").TrimEnd('/') + path;

    public string AdminUrl(string path) => (FrontOrigin() ?? "http://localhost:5173").TrimEnd('/') + path;

    public IEnumerable<string> BaseDomains() =>
        (configuration.GetSection("Ecommerce:StoreBaseDomains").Get<string[]>() ?? []).Select(d => d.Trim().ToLowerInvariant()).Where(d => d.Length > 0);

    private string? FrontOrigin()
    {
        var v = configuration["Ecommerce:PublicBaseUrl"] ?? configuration["FrontendUrl"];
        return string.IsNullOrWhiteSpace(v) ? null : v.TrimEnd('/');
    }
}

internal sealed record PricedLine(StorefrontCheckoutVariantDto Variant, int Quantity, int? MaxQuantity, string? Problem)
{
    public decimal LineTotal(string currency) => Money.Round(Variant.Price, currency) * Quantity;
}

internal sealed record PricedCart(
    IReadOnlyList<PricedLine> Lines, decimal Subtotal, decimal DiscountTotal, DiscountCode? Discount, string? DiscountError,
    IReadOnlyList<ShopShippingOptionDto> Options, Guid? SelectedZoneId, decimal ShippingTotal, decimal TaxTotal, decimal Total,
    bool FreeShippingApplied)
{
    public bool HasProblems => Lines.Any(l => l.Problem is not null) || Lines.Count == 0;
}

/// <summary>
/// Prices a cart from Inventory's live figures. The browser only ever says "this product, this many" — every price, stock
/// level, discount and delivery charge comes from here, so nothing the shopper's device holds can lower a price.
/// </summary>
internal sealed class StorePricing(EcommerceDbContext db, ISender sender)
{
    public async Task<PricedCart> QuoteAsync(Store store, IReadOnlyList<ShopCartLine> items, string? discountCode, string? country, Guid? zoneId, CancellationToken ct)
    {
        var cur = store.CurrencyCode;
        var merged = items.Where(i => i.Quantity > 0).GroupBy(i => i.ProductId)
            .Select(g => (ProductId: g.Key, Quantity: Math.Min(999, g.Sum(x => x.Quantity)))).ToList();

        var fetched = merged.Count == 0 ? null : await sender.Send(new GetStorefrontCheckoutVariantsQuery(merged.Select(m => m.ProductId).ToList()), ct);
        IReadOnlyList<StorefrontCheckoutVariantDto> variants = fetched is { IsSuccess: true } ? fetched.Value : [];
        var byId = variants.ToDictionary(v => v.ProductId);

        var lines = new List<PricedLine>();
        foreach (var (productId, qty) in merged)
        {
            if (!byId.TryGetValue(productId, out var v) || !v.Available)
            {
                // Show something the shopper can read even though the product is gone.
                var gone = new StorefrontCheckoutVariantDto(productId, Guid.Empty, "Unavailable item", "", "", null, 0, 0, 0, false, false, null, null);
                lines.Add(new PricedLine(v ?? gone, qty, 0, "This item is no longer available."));
                continue;
            }
            if (v.TrackInventory)
            {
                var max = (int)Math.Max(0, Math.Floor(v.Stock));
                if (max == 0) { lines.Add(new PricedLine(v, qty, 0, "Out of stock.")); continue; }
                if (qty > max) { lines.Add(new PricedLine(v, qty, max, $"Only {max} left.")); continue; }
                lines.Add(new PricedLine(v, qty, max, null));
            }
            else lines.Add(new PricedLine(v, qty, null, null));
        }

        var subtotal = lines.Where(l => l.Problem is null).Sum(l => l.LineTotal(cur));

        // ── Discount ──
        DiscountCode? discount = null; string? discountError = null; decimal discountTotal = 0; var freeShipping = false;
        if (!string.IsNullOrWhiteSpace(discountCode))
        {
            var code = discountCode.Trim().ToUpperInvariant();
            var d = await db.DiscountCodes.AsNoTracking().FirstOrDefaultAsync(x => x.Code == code && !x.IsDeleted, ct);
            var now = DateTime.UtcNow;
            if (d is null || !d.IsActive) discountError = "That code is not valid.";
            else if (d.StartsAt > now) discountError = "That code is not active yet.";
            else if (d.EndsAt < now) discountError = "That code has expired.";
            else if (d.MaxUses is int max && d.UsedCount >= max) discountError = "That code has been used up.";
            else if (d.MinSubtotal is decimal min && subtotal < min) discountError = $"Spend at least {Money.Round(min, cur)} to use that code.";
            else
            {
                discount = d;
                discountTotal = d.Kind switch
                {
                    DiscountKinds.Percent => Money.Round(subtotal * d.Value / 100m, cur),
                    DiscountKinds.Fixed => Math.Min(subtotal, Money.Round(d.Value, cur)),
                    _ => 0,
                };
                freeShipping = d.Kind == DiscountKinds.FreeShipping;
            }
        }
        var afterDiscount = Math.Max(0, subtotal - discountTotal);

        // ── Delivery: every active zone that lists the country is offered ──
        var options = new List<ShopShippingOptionDto>();
        if (!string.IsNullOrWhiteSpace(country))
        {
            var cc = country.Trim().ToUpperInvariant();
            var zones = await db.ShippingZones.AsNoTracking().Where(z => z.IsActive && !z.IsDeleted)
                .OrderBy(z => z.SortOrder).ThenBy(z => z.Name).ToListAsync(ct);
            foreach (var z in zones)
            {
                var countries = ShopJson.Strings(z.CountriesJson);
                if (!countries.Contains("*") && !countries.Contains(cc, StringComparer.OrdinalIgnoreCase)) continue;
                if (z.MinOrder is decimal mo && subtotal < mo) continue;
                var free = freeShipping || (z.FreeOver is decimal fo && afterDiscount >= fo);
                options.Add(new ShopShippingOptionDto(z.Id, z.Name, free ? 0 : Money.Round(z.FlatRate, cur), z.EstimatedDays, free));
            }
        }
        var selected = options.FirstOrDefault(o => o.ZoneId == zoneId) ?? options.FirstOrDefault();
        var shipping = selected?.Price ?? 0;

        // ── Tax ──
        var baseAmount = afterDiscount + shipping;
        decimal tax, total;
        if (store.TaxPercent <= 0) { tax = 0; total = baseAmount; }
        else if (store.PricesIncludeTax) { tax = Money.Round(baseAmount * store.TaxPercent / (100m + store.TaxPercent), cur); total = baseAmount; }
        else { tax = Money.Round(baseAmount * store.TaxPercent / 100m, cur); total = baseAmount + tax; }

        return new PricedCart(lines, subtotal, discountTotal, discount, discountError, options, selected?.ZoneId, shipping, tax, total, freeShipping);
    }
}

/// <summary>
/// What happens to an order after it exists: stock held, paid, cancelled, refunded, and who is told. One place, so the
/// webhook, the PayPal return, the shopper's page and the staff screen all do exactly the same thing.
/// </summary>
internal sealed class StoreOrderService(
    EcommerceDbContext db, IInventoryCatalogue inventory, IShopMailer mailer, INotificationDispatcher notifier,
    INotificationRecipients recipients, ShopLinks links, ILogger<StoreOrderService> log)
{
    private static string Ref(StoreOrder o) => $"Online order {o.Number}";

    /// <summary>
    /// Checks every tracked line is still in stock and takes it, as one step per product. All or nothing: if any line cannot be
    /// taken, the ones already taken are put back and the order is not placed.
    /// </summary>
    public async Task<Result> TakeStockAsync(StoreOrder order, CancellationToken ct)
    {
        var tracked = order.Lines.Where(l => l.TrackInventory).ToList();
        if (tracked.Count == 0) { order.StockTaken = true; return Result.Success(); }

        using var _ = await StockGuard.LockAsync(tracked.Select(l => l.ProductId), ct);
        foreach (var l in tracked)
        {
            var have = await inventory.GetStockAsync(l.ProductId, ct);
            if (have is null || have < l.Quantity)
                return Result.Failure(ShopErrors.Conflict($"Sorry — {l.Title} is no longer available in that quantity."));
        }

        var taken = new List<StoreOrderLine>();
        foreach (var l in tracked)
        {
            var r = await inventory.TakeStockAsync(l.ProductId, l.Quantity, Ref(order), $"Sold online: {l.Title}", ct);
            if (r.IsFailure)
            {
                foreach (var t in taken) await inventory.ReturnStockAsync(t.ProductId, t.Quantity, Ref(order), "Order could not be completed", ct);
                return Result.Failure(ShopErrors.Conflict("Sorry — we could not reserve your items. Please try again."));
            }
            l.StockTaken = true; taken.Add(l);
        }
        order.StockTaken = true;
        return Result.Success();
    }

    public async Task ReturnStockAsync(StoreOrder order, string why, CancellationToken ct)
    {
        foreach (var l in order.Lines.Where(l => l.StockTaken))
        {
            var r = await inventory.ReturnStockAsync(l.ProductId, l.Quantity, Ref(order), why, ct);
            if (r.IsSuccess) l.StockTaken = false;
            else log.LogWarning("Could not return stock for {Order} line {Product}: {Error}", order.Number, l.ProductId, r.Error.Description);
        }
        order.StockReturned = order.Lines.All(l => !l.StockTaken);
    }

    /// <summary>Records money received. Idempotent: a repeated webhook or a second poll changes nothing.</summary>
    public async Task<bool> MarkPaidAsync(Store store, StoreOrder order, string? reference, string? by, string? origin, CancellationToken ct)
    {
        if (order.PaymentStatus == StorePaymentStatuses.Paid) return false;
        if (order.Status == StoreOrderStatuses.Cancelled)
        {
            // Money arrived for an order we had already given up on (expired while the shopper was paying). Keep the record
            // straight rather than quietly shipping it: staff see the event and decide.
            order.PaymentStatus = StorePaymentStatuses.Paid; order.PaidAt = DateTime.UtcNow; order.PaymentReference = reference ?? order.PaymentReference;
            order.AddEvent("payment", "Payment received AFTER the order was cancelled. Refund it or reinstate the order.", by);
            order.Touch(); await db.SaveChangesAsync(ct);
            await NotifyStaffAsync(store, order, "Payment received for a cancelled order", $"Order {order.Number} was paid after it expired. Check it.", ct);
            return true;
        }

        order.PaymentStatus = StorePaymentStatuses.Paid;
        order.PaidAt = DateTime.UtcNow;
        order.PaymentReference = reference ?? order.PaymentReference;
        order.ExpiresAt = null;
        if (order.Status == StoreOrderStatuses.AwaitingPayment) order.Status = StoreOrderStatuses.Placed;
        order.AddEvent("payment", "Payment received.", by);
        order.Touch();
        await db.SaveChangesAsync(ct);

        if (order.PaymentMethod is PaymentMethods.Stripe or PaymentMethods.PayPal) await AnnouncePlacedAsync(store, order, origin, ct);
        return true;
    }

    public async Task CancelAsync(Store store, StoreOrder order, string reason, string? by, CancellationToken ct)
    {
        if (order.Status == StoreOrderStatuses.Cancelled) return;
        order.Status = StoreOrderStatuses.Cancelled;
        order.CancelledAt = DateTime.UtcNow;
        order.CancelReason = reason.Length > 500 ? reason[..500] : reason;
        order.ExpiresAt = null;
        if (order.PaymentStatus == StorePaymentStatuses.Pending) order.PaymentStatus = StorePaymentStatuses.Failed;
        order.AddEvent("cancelled", reason, by);

        await ReturnStockAsync(order, "Order cancelled", ct);

        if (!string.IsNullOrEmpty(order.DiscountCode))
        {
            var code = order.DiscountCode;
            await db.DiscountCodes.Where(d => d.Code == code && d.UsedCount > 0)
                .ExecuteUpdateAsync(s => s.SetProperty(d => d.UsedCount, d => d.UsedCount - 1), ct);
        }
        order.Touch();
        await db.SaveChangesAsync(ct);
    }

    /// <summary>Tells the shopper (confirmation) and the staff (email + bell) once an order is really in: paid, or accepted for cash / transfer.</summary>
    public async Task AnnouncePlacedAsync(Store store, StoreOrder order, string? origin, CancellationToken ct)
    {
        if (order.MerchantNotified) return;
        order.MerchantNotified = true;
        await db.SaveChangesAsync(ct);

        try
        {
            var orderUrl = links.ShopUrl(store, origin, $"/order/{order.Seq}?k={order.AccessToken}");
            var instructions = order.PaymentMethod == PaymentMethods.Bank ? store.BankDetails : store.CodInstructions;
            // Rendered now (the order is in memory), sent in the background: a slow mail server must never hold up a customer's checkout.
            var (subject, html) = ShopEmails.Confirmation(store, order, orderUrl, instructions);
            var email = order.Email; var name = order.CustomerName;
            var notify = !string.IsNullOrWhiteSpace(store.OrderNotifyEmail) ? store.OrderNotifyEmail : store.ContactEmail;
            (string Subject, string Html)? staffMail = string.IsNullOrWhiteSpace(notify) ? null : ShopEmails.NewOrder(store, order, links.AdminUrl("/ecommerce/store/orders"));
            var storeName = store.Name;
            _ = Task.Run(async () =>
            {
                await mailer.SendAsync(email, name, subject, html, CancellationToken.None);
                if (staffMail is { } m) await mailer.SendAsync(notify!, storeName, m.Subject, m.Html, CancellationToken.None);
            });
            await NotifyStaffAsync(store, order, $"New online order {order.Number}",
                $"{order.CustomerName} · {Money.Round(order.Total, order.CurrencyCode)} {order.CurrencyCode} · {order.PaymentMethod}", ct);
        }
        catch (Exception ex) { log.LogError(ex, "Announcing order {Order} failed.", order.Number); }   // an alert must never fail the order
    }

    private async Task NotifyStaffAsync(Store store, StoreOrder order, string title, string message, CancellationToken ct)
    {
        var tenantId = Softaxis.BuildingBlocks.Domain.Multitenancy.TenantAmbient.TenantId;
        if (tenantId is null) return;
        var people = await recipients.WithPermissionAsync(tenantId.Value, "ecommerce.orders.view", ct);
        await notifier.PublishManyAsync(people.Select(p => new NotificationRequest(
            p, "ecommerce", "store.order", title, message, "/ecommerce/store/orders", "info", "store_order", order.Id, tenantId)), ct);
    }

    public async Task SendShippedEmailAsync(Store store, StoreOrder order, CancellationToken ct)
    {
        var url = links.ShopUrl(store, null, $"/order/{order.Seq}?k={order.AccessToken}");
        var (s, h) = ShopEmails.Shipped(store, order, url);
        var email = order.Email; var name = order.CustomerName;
        _ = Task.Run(() => mailer.SendAsync(email, name, s, h, CancellationToken.None));
        await Task.CompletedTask;
    }
}
