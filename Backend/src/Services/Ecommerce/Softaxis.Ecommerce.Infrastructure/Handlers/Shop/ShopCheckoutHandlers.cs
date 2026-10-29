using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Ecommerce.Application.Abstractions;
using Softaxis.Ecommerce.Application.Shop;
using Softaxis.Ecommerce.Domain.Entities;
using Softaxis.Ecommerce.Infrastructure.Persistence;
using Softaxis.Ecommerce.Infrastructure.Services.Shop;

namespace Softaxis.Ecommerce.Infrastructure.Handlers.Shop;

internal static class ShopOrders
{
    /// <summary>"#1001", "1001" or "%231001" → 1001.</summary>
    public static int? ParseSeq(string? number) =>
        int.TryParse((number ?? "").Trim().TrimStart('#'), NumberStyles.None, CultureInfo.InvariantCulture, out var n) ? n : null;

    public static bool TokenMatches(StoreOrder o, string? token) =>
        !string.IsNullOrEmpty(token)
        && CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(o.AccessToken), Encoding.ASCII.GetBytes(token.Trim().ToLowerInvariant()));

    /// <summary>The order a shopper's link points at. Same answer for "no such order" and "wrong token": a number alone proves nothing.</summary>
    public static async Task<StoreOrder?> FindAsync(EcommerceDbContext db, string number, string token, CancellationToken ct)
    {
        var seq = ParseSeq(number);
        if (seq is null) return null;
        var o = await db.StoreOrders.Include(x => x.Lines).Include(x => x.Events).FirstOrDefaultAsync(x => x.Seq == seq, ct);
        return o is not null && TokenMatches(o, token) ? o : null;
    }

    public static bool CanPay(StoreOrder o) =>
        o.Status == StoreOrderStatuses.AwaitingPayment && o.PaymentStatus == StorePaymentStatuses.Pending
        && o.PaymentMethod is PaymentMethods.Stripe or PaymentMethods.PayPal && o.StockTaken | !o.Lines.Any(l => l.TrackInventory);

    public static ShopOrderDto ToDto(Store store, StoreOrder o) => new(
        o.Number, o.Status, o.PaymentMethod, o.PaymentStatus, o.CurrencyCode, o.Email, o.CustomerName,
        o.ShipName, o.ShipLine1, o.ShipLine2, o.ShipCity, o.ShipRegion, o.ShipPostal, o.ShipCountry,
        o.ShippingMethod, o.Subtotal, o.DiscountTotal, o.ShippingTotal, o.TaxTotal, o.Total,
        o.TrackingCarrier, o.TrackingNumber, o.TrackingUrl, o.CreatedAt, CanPay(o),
        o.PaymentMethod == PaymentMethods.Bank ? store.BankDetails : o.PaymentMethod == PaymentMethods.Cod ? store.CodInstructions : null,
        o.Lines.Select(l => new ShopOrderLineDto(l.Title, l.VariantName, l.Quantity, l.UnitPrice, l.LineTotal)).ToList());
}

/// <summary>Starts a card / PayPal payment for an order and records the provider's reference on it.</summary>
internal sealed class PaymentStarter(StripeGateway stripe, PayPalGateway paypal, ISecretProtector protector, ShopLinks links)
{
    public async Task<Result<string>> StartAsync(Store store, StoreOrder order, string? origin, CancellationToken ct)
    {
        var back = $"/order/{order.Seq}?k={order.AccessToken}";
        try
        {
            if (order.PaymentMethod == PaymentMethods.Stripe)
            {
                var key = store.StripeSecretEnc is null ? null : protector.Unprotect(store.StripeSecretEnc);
                if (key is null) return Result.Failure<string>(ShopErrors.Conflict("Card payments are not set up for this store."));
                var (id, url) = await stripe.CreateCheckoutAsync(key, store, order, links.ShopUrl(store, origin, back + "&paid=1"), links.ShopUrl(store, origin, "/cart"), ct);
                order.StripeSessionId = id;
                order.ExpiresAt = DateTime.UtcNow.AddMinutes(65);
                return Result.Success(url);
            }
            if (order.PaymentMethod == PaymentMethods.PayPal)
            {
                var secret = store.PayPalSecretEnc is null ? null : protector.Unprotect(store.PayPalSecretEnc);
                if (secret is null || string.IsNullOrEmpty(store.PayPalClientId)) return Result.Failure<string>(ShopErrors.Conflict("PayPal is not set up for this store."));
                var (id, url) = await paypal.CreateOrderAsync(store.PayPalClientId, secret, store.PayPalSandbox, order,
                    links.ShopUrl(store, origin, back + "&paypal=1"), links.ShopUrl(store, origin, "/cart"), store.Name, ct);
                order.PayPalOrderId = id;
                order.ExpiresAt = DateTime.UtcNow.AddMinutes(65);
                return Result.Success(url);
            }
        }
        catch (PaymentException ex) { return Result.Failure<string>(Error.Custom("Order.Unavailable", ex.Message)); }
        return Result.Failure<string>(ShopErrors.Conflict("That payment method does not need a payment page."));
    }
}

internal sealed class ShopCheckoutHandler(
    ShopGate gate, EcommerceDbContext db, StorePricing pricing, StoreOrderService orders, PaymentStarter payments,
    IShopSecurity security, ILogger<ShopCheckoutHandler> log)
    : ICommandHandler<ShopCheckoutCommand, ShopCheckoutResultDto>
{
    public async Task<Result<ShopCheckoutResultDto>> Handle(ShopCheckoutCommand c, CancellationToken ct)
    {
        var door = await gate.OpenAsync(c.Slug, ct);
        if (door.IsFailure) return Result.Failure<ShopCheckoutResultDto>(door.Error);
        door.Value.Enter();
        var store = door.Value.Store;

        // ── Who and how ──
        Guid? customerId = null;
        if (!string.IsNullOrWhiteSpace(c.CustomerToken))
        {
            var session = security.ReadSession(c.CustomerToken);
            if (session is not null && session.TenantId == door.Value.Tenant.Id
                && await db.Customers.AnyAsync(x => x.Id == session.CustomerId && !x.IsDeleted, ct))
                customerId = session.CustomerId;
        }
        if (customerId is null && !store.AllowGuestCheckout)
            return Fail("Please sign in to place an order.");
        if (store.RequirePhone && string.IsNullOrWhiteSpace(c.Phone)) return Fail("Please enter a phone number so we can reach you about your delivery.");

        var method = c.PaymentMethod.Trim().ToLowerInvariant();
        if (!ShopMapping.PaymentMethods(store).Any(m => m.Method == method)) return Fail("That payment method is not available.");

        // ── Price it again, from the server's figures ──
        var cart = await pricing.QuoteAsync(store, c.Items, c.DiscountCode, c.Country, c.ZoneId, ct);
        if (cart.Lines.Count == 0) return Fail("Your cart is empty.");
        var problem = cart.Lines.FirstOrDefault(l => l.Problem is not null);
        if (problem is not null) return Fail($"{problem.Variant.TemplateName}: {problem.Problem}");
        if (!string.IsNullOrWhiteSpace(c.DiscountCode) && cart.DiscountError is not null) return Fail(cart.DiscountError);
        var zone = cart.Options.FirstOrDefault(o => o.ZoneId == c.ZoneId);
        if (zone is null) return Fail("We do not deliver to that country, or the delivery option is no longer available.");

        var cur = store.CurrencyCode;
        var name = c.Name.Trim();
        var order = new StoreOrder(await NextSeqAsync(ct), c.Email, cur, method)
        {
            CustomerId = customerId, Phone = Clean(c.Phone), CustomerName = name,
            ShipName = name, ShipLine1 = c.Line1.Trim(), ShipLine2 = Clean(c.Line2), ShipCity = c.City.Trim(), ShipRegion = Clean(c.Region),
            ShipPostal = Clean(c.PostalCode), ShipCountry = c.Country.Trim().ToUpperInvariant(),
            ShippingMethod = zone.Name, Subtotal = cart.Subtotal, DiscountTotal = cart.DiscountTotal, DiscountCode = cart.Discount?.Code,
            ShippingTotal = cart.ShippingTotal, TaxTotal = cart.TaxTotal, Total = cart.Total, CustomerNote = Clean(c.Note),
        };
        foreach (var l in cart.Lines)
        {
            var v = l.Variant;
            order.Lines.Add(new StoreOrderLine(order.Id, v.ProductId, v.TemplateId, v.TemplateName,
                string.Equals(v.VariantName, v.TemplateName, StringComparison.OrdinalIgnoreCase) ? null : v.VariantName,
                v.Sku, l.Quantity, Money.Round(v.Price, cur), v.TrackInventory));
        }
        order.AddEvent("created", $"Order placed ({method}).", name);

        // ── Reserve stock, then the code's use ──
        var stock = await orders.TakeStockAsync(order, ct);
        if (stock.IsFailure) return Result.Failure<ShopCheckoutResultDto>(stock.Error);

        if (cart.Discount is not null)
        {
            var id = cart.Discount.Id;
            var used = await db.DiscountCodes.Where(d => d.Id == id && (d.MaxUses == null || d.UsedCount < d.MaxUses))
                .ExecuteUpdateAsync(s => s.SetProperty(d => d.UsedCount, d => d.UsedCount + 1), ct);
            if (used == 0)
            {
                await orders.ReturnStockAsync(order, "Discount code used up", ct);
                return Fail("That code has just been used up.");
            }
        }

        // ── Save (a second order taking the same number retries with the next) ──
        db.StoreOrders.Add(order);
        for (var attempt = 0; ; attempt++)
        {
            try { await db.SaveChangesAsync(ct); break; }
            catch (DbUpdateException ex) when (attempt < 3 && IsSeqCollision(ex))
            {
                db.Entry(order).State = EntityState.Detached;
                foreach (var l in order.Lines) db.Entry(l).State = EntityState.Detached;
                order = Renumber(order, await NextSeqAsync(ct), order.Lines);
                db.StoreOrders.Add(order);
            }
            catch (Exception ex)
            {
                log.LogError(ex, "Saving a store order failed; releasing its stock.");
                await orders.ReturnStockAsync(order, "Order could not be saved", ct);
                throw;
            }
        }

        // ── Payment ──
        string? redirect = null;
        if (order.Total <= 0)
        {
            // Nothing to pay (a 100% code, or a free item): accepted as paid.
            order.PaymentStatus = StorePaymentStatuses.Paid; order.PaidAt = DateTime.UtcNow;
            order.AddEvent("payment", "Nothing to pay.");
            await db.SaveChangesAsync(ct);
            await orders.AnnouncePlacedAsync(store, order, c.Origin, ct);
        }
        else if (method is PaymentMethods.Stripe or PaymentMethods.PayPal)
        {
            order.Status = StoreOrderStatuses.AwaitingPayment;
            var started = await payments.StartAsync(store, order, c.Origin, ct);
            if (started.IsFailure)
            {
                await orders.CancelAsync(store, order, "Payment could not be started.", null, ct);
                return Result.Failure<ShopCheckoutResultDto>(started.Error);
            }
            redirect = started.Value;
            order.AddEvent("payment", $"Waiting for {(method == PaymentMethods.Stripe ? "card" : "PayPal")} payment.");
            await db.SaveChangesAsync(ct);
        }
        else
        {
            // Cash on delivery / bank transfer: accepted now, money follows.
            order.Status = StoreOrderStatuses.Placed;
            await db.SaveChangesAsync(ct);
            await orders.AnnouncePlacedAsync(store, order, c.Origin, ct);
        }

        if (c.SaveAddress && customerId is Guid cid) await SaveAddressAsync(cid, order, ct);
        return Result.Success(new ShopCheckoutResultDto(order.Number, order.AccessToken, order.Status, order.PaymentStatus, redirect));
    }

    private async Task SaveAddressAsync(Guid customerId, StoreOrder o, CancellationToken ct)
    {
        try
        {
            var a = new StoreCustomerAddress(customerId)
            {
                Name = o.ShipName, Phone = o.Phone, Line1 = o.ShipLine1, Line2 = o.ShipLine2, City = o.ShipCity, Region = o.ShipRegion,
                PostalCode = o.ShipPostal, Country = o.ShipCountry, IsDefault = !await db.CustomerAddresses.AnyAsync(x => x.CustomerId == customerId, ct),
            };
            db.CustomerAddresses.Add(a);
            await db.SaveChangesAsync(ct);
        }
        catch (Exception ex) { log.LogWarning(ex, "Saving the shopper's address failed."); }   // the order is placed regardless
    }

    private async Task<int> NextSeqAsync(CancellationToken ct) => (await db.StoreOrders.MaxAsync(o => (int?)o.Seq, ct) ?? 1000) + 1;

    private static bool IsSeqCollision(DbUpdateException ex) => ex.InnerException?.Message.Contains("IX_store_orders", StringComparison.OrdinalIgnoreCase) == true;

    /// <summary>The same order under a new number (the colliding one never reached the database).</summary>
    private static StoreOrder Renumber(StoreOrder o, int seq, List<StoreOrderLine> lines)
    {
        var n = new StoreOrder(seq, o.Email, o.CurrencyCode, o.PaymentMethod)
        {
            CustomerId = o.CustomerId, Phone = o.Phone, CustomerName = o.CustomerName, ShipName = o.ShipName, ShipLine1 = o.ShipLine1, ShipLine2 = o.ShipLine2,
            ShipCity = o.ShipCity, ShipRegion = o.ShipRegion, ShipPostal = o.ShipPostal, ShipCountry = o.ShipCountry, ShippingMethod = o.ShippingMethod,
            Subtotal = o.Subtotal, DiscountTotal = o.DiscountTotal, DiscountCode = o.DiscountCode, ShippingTotal = o.ShippingTotal, TaxTotal = o.TaxTotal,
            Total = o.Total, CustomerNote = o.CustomerNote, StockTaken = o.StockTaken,
        };
        foreach (var l in lines)
            n.Lines.Add(new StoreOrderLine(n.Id, l.ProductId, l.TemplateId, l.Title, l.VariantName, l.Sku, l.Quantity, l.UnitPrice, l.TrackInventory) { StockTaken = l.StockTaken });
        n.AddEvent("created", $"Order placed ({o.PaymentMethod}).", o.CustomerName);
        return n;
    }

    private static string? Clean(string? v) => string.IsNullOrWhiteSpace(v) ? null : v.Trim();
    private static Result<ShopCheckoutResultDto> Fail(string message) => Result.Failure<ShopCheckoutResultDto>(ShopErrors.Conflict(message));
}

internal sealed class GetShopOrderHandler(ShopGate gate, EcommerceDbContext db, StoreOrderService orders, StripeGateway stripe, ISecretProtector protector, ILogger<GetShopOrderHandler> log)
    : IQueryHandler<GetShopOrderQuery, ShopOrderDto>
{
    public async Task<Result<ShopOrderDto>> Handle(GetShopOrderQuery q, CancellationToken ct)
    {
        var door = await gate.OpenAsync(q.Slug, ct, requirePublished: false);
        if (door.IsFailure) return Result.Failure<ShopOrderDto>(door.Error);
        door.Value.Enter();
        var store = door.Value.Store;

        var o = await ShopOrders.FindAsync(db, q.Number, q.Token, ct);
        if (o is null) return Result.Failure<ShopOrderDto>(ShopErrors.NoOrder);

        // The shopper lands here straight after paying, usually before Stripe's webhook has arrived (or when the owner has not
        // set the webhook up at all). Ask Stripe directly so the page tells the truth either way.
        if (o.PaymentMethod == PaymentMethods.Stripe && o.Status == StoreOrderStatuses.AwaitingPayment && !string.IsNullOrEmpty(o.StripeSessionId))
        {
            try
            {
                var key = store.StripeSecretEnc is null ? null : protector.Unprotect(store.StripeSecretEnc);
                if (key is not null) await StripeReconcile.ApplyAsync(stripe, key, store, o, orders, ct);
            }
            catch (PaymentException ex) { log.LogInformation("Stripe check for {Order} deferred: {Message}", o.Number, ex.Message); }
        }
        return Result.Success(ShopOrders.ToDto(store, o));
    }
}

internal static class StripeReconcile
{
    /// <summary>Marks the order paid / cancelled to match the Stripe session. Amount and currency must match what we asked for.</summary>
    public static async Task ApplyAsync(StripeGateway stripe, string key, Store store, StoreOrder o, StoreOrderService orders, CancellationToken ct)
    {
        var s = await stripe.GetSessionAsync(key, o.StripeSessionId!, ct);
        await ApplySessionAsync(store, o, s, orders, ct);
    }

    public static async Task ApplySessionAsync(Store store, StoreOrder o, StripeSessionInfo s, StoreOrderService orders, CancellationToken ct)
    {
        if (s.PaymentStatus == "paid")
        {
            if (s.AmountTotal != Money.ToMinor(o.Total, o.CurrencyCode) || !string.Equals(s.Currency, o.CurrencyCode, StringComparison.OrdinalIgnoreCase))
            {
                // Money arrived but not the sum we expected. Never mark it settled on a mismatch: flag it for a person.
                if (!o.Events.Any(e => e.Kind == "mismatch"))
                {
                    o.AddEvent("mismatch", $"Stripe reports {s.AmountTotal} {s.Currency} paid, expected {Money.ToMinor(o.Total, o.CurrencyCode)} {o.CurrencyCode}. Check it in Stripe.");
                    o.Touch();
                }
                return;
            }
            await orders.MarkPaidAsync(store, o, s.PaymentIntent ?? s.Id, "Stripe", null, ct);
        }
        else if (s.Status == "expired" && o.Status == StoreOrderStatuses.AwaitingPayment)
            await orders.CancelAsync(store, o, "The card payment was not completed in time.", "Stripe", ct);
    }
}

internal sealed class CaptureShopPayPalHandler(ShopGate gate, EcommerceDbContext db, StoreOrderService orders, PayPalGateway paypal, ISecretProtector protector)
    : ICommandHandler<CaptureShopPayPalCommand, ShopOrderDto>
{
    public async Task<Result<ShopOrderDto>> Handle(CaptureShopPayPalCommand c, CancellationToken ct)
    {
        var door = await gate.OpenAsync(c.Slug, ct, requirePublished: false);
        if (door.IsFailure) return Result.Failure<ShopOrderDto>(door.Error);
        door.Value.Enter();
        var store = door.Value.Store;

        var o = await ShopOrders.FindAsync(db, c.Number, c.Token, ct);
        if (o is null) return Result.Failure<ShopOrderDto>(ShopErrors.NoOrder);
        if (o.PaymentStatus == StorePaymentStatuses.Paid) return Result.Success(ShopOrders.ToDto(store, o));

        // The id must be the one WE created for this order — otherwise a shopper could present some other PayPal order's approval.
        if (o.PaymentMethod != PaymentMethods.PayPal || o.Status != StoreOrderStatuses.AwaitingPayment
            || !string.Equals(o.PayPalOrderId, c.PayPalOrderId, StringComparison.Ordinal))
            return Result.Failure<ShopOrderDto>(ShopErrors.Conflict("This order cannot be paid with that PayPal payment."));

        var secret = store.PayPalSecretEnc is null ? null : protector.Unprotect(store.PayPalSecretEnc);
        if (secret is null || string.IsNullOrEmpty(store.PayPalClientId)) return Result.Failure<ShopOrderDto>(ShopErrors.Conflict("PayPal is not set up for this store."));

        PayPalCaptureInfo cap;
        try { cap = await paypal.CaptureAsync(store.PayPalClientId, secret, store.PayPalSandbox, c.PayPalOrderId, ct); }
        catch (PaymentException ex) { return Result.Failure<ShopOrderDto>(Error.Custom("Order.Unavailable", ex.Message)); }

        if (!string.Equals(cap.Status, "COMPLETED", StringComparison.OrdinalIgnoreCase))
            return Result.Failure<ShopOrderDto>(ShopErrors.Conflict("PayPal has not completed this payment."));
        if (cap.AmountMinor != Money.ToMinor(o.Total, o.CurrencyCode) || !string.Equals(cap.Currency, o.CurrencyCode, StringComparison.OrdinalIgnoreCase))
        {
            o.AddEvent("mismatch", $"PayPal captured {cap.AmountMinor} {cap.Currency}, expected {Money.ToMinor(o.Total, o.CurrencyCode)} {o.CurrencyCode}. Check it in PayPal.");
            o.Touch(); await db.SaveChangesAsync(ct);
            return Result.Failure<ShopOrderDto>(ShopErrors.Conflict("The payment amount did not match. We have flagged it and will be in touch."));
        }

        await orders.MarkPaidAsync(store, o, cap.CaptureId, "PayPal", null, ct);
        return Result.Success(ShopOrders.ToDto(store, o));
    }
}

internal sealed class StartShopPaymentHandler(ShopGate gate, EcommerceDbContext db, PaymentStarter payments)
    : ICommandHandler<StartShopPaymentCommand, ShopCheckoutResultDto>
{
    public async Task<Result<ShopCheckoutResultDto>> Handle(StartShopPaymentCommand c, CancellationToken ct)
    {
        var door = await gate.OpenAsync(c.Slug, ct);
        if (door.IsFailure) return Result.Failure<ShopCheckoutResultDto>(door.Error);
        door.Value.Enter();

        var o = await ShopOrders.FindAsync(db, c.Number, c.Token, ct);
        if (o is null) return Result.Failure<ShopCheckoutResultDto>(ShopErrors.NoOrder);
        if (!ShopOrders.CanPay(o)) return Result.Failure<ShopCheckoutResultDto>(ShopErrors.Conflict("This order can no longer be paid. Please place a new order."));

        var started = await payments.StartAsync(door.Value.Store, o, c.Origin, ct);
        if (started.IsFailure) return Result.Failure<ShopCheckoutResultDto>(started.Error);
        o.AddEvent("payment", "Payment restarted.");
        o.Touch();
        await db.SaveChangesAsync(ct);
        return Result.Success(new ShopCheckoutResultDto(o.Number, o.AccessToken, o.Status, o.PaymentStatus, started.Value));
    }
}

internal sealed class ShopStripeWebhookHandler(
    ShopGate gate, EcommerceDbContext db, StoreOrderService orders, ISecretProtector protector, ILogger<ShopStripeWebhookHandler> log)
    : ICommandHandler<ShopStripeWebhookCommand>
{
    public async Task<Result> Handle(ShopStripeWebhookCommand c, CancellationToken ct)
    {
        var door = await gate.OpenAsync(c.Slug, ct, requirePublished: false);
        if (door.IsFailure) return Result.Failure(door.Error);
        door.Value.Enter();
        var store = door.Value.Store;

        // Fails closed: with no signing secret every webhook is refused, so a stranger cannot mark orders paid by posting JSON.
        var secret = store.StripeWebhookSecretEnc is null ? null : protector.Unprotect(store.StripeWebhookSecretEnc);
        if (secret is null || !StripeGateway.VerifySignature(c.Payload, c.Signature, secret, DateTimeOffset.UtcNow))
            return Result.Failure(Error.Custom("Webhook.Invalid", "Signature could not be verified."));

        JsonElement evt;
        try { evt = JsonDocument.Parse(c.Payload).RootElement.Clone(); }
        catch (JsonException) { return Result.Failure(Error.Custom("Webhook.Invalid", "Bad payload.")); }

        var type = evt.TryGetProperty("type", out var t) ? t.GetString() : null;
        if (type is not ("checkout.session.completed" or "checkout.session.async_payment_succeeded" or "checkout.session.async_payment_failed" or "checkout.session.expired"))
            return Result.Success();   // events we do not act on are acknowledged so Stripe stops resending them

        var obj = evt.GetProperty("data").GetProperty("object");
        var session = StripeGateway.ReadSession(obj);
        var o = await db.StoreOrders.Include(x => x.Lines).Include(x => x.Events).FirstOrDefaultAsync(x => x.StripeSessionId == session.Id, ct);
        if (o is null) { log.LogInformation("Stripe event for an unknown session {Session}.", session.Id); return Result.Success(); }

        if (type == "checkout.session.async_payment_failed")
        {
            if (o.Status == StoreOrderStatuses.AwaitingPayment) await orders.CancelAsync(store, o, "The card payment failed.", "Stripe", ct);
            return Result.Success();
        }
        await StripeReconcile.ApplySessionAsync(store, o, session, orders, ct);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
