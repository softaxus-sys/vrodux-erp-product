using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Softaxis.Ecommerce.Application.Abstractions;
using Softaxis.Ecommerce.Application.Channels;
using Softaxis.Ecommerce.Domain.Entities;
using Softaxis.Ecommerce.Infrastructure.Persistence;

namespace Softaxis.Ecommerce.Infrastructure.Services;

/// <summary>
/// Everything that moves data between Inventory and a store. Used by the handlers (a person pressed a button) and by
/// <see cref="ChannelSyncWorker"/> (every couple of minutes), so both do exactly the same thing.
///
/// <para>
/// <b>Stock.</b> The first push of a variant sets the level; after that only the CHANGE is sent (an adjustment). A set
/// would overwrite an order the store took a moment ago, which the importer has not seen yet. When an order is imported
/// its quantity is taken out of Inventory and out of the remembered store level in the same step, so it is not sent back
/// to the store as a change.
/// </para>
///
/// <para>
/// <b>Failures.</b> A store that is down or rate-limiting (<see cref="ChannelFailure.Transient"/>) stops the pass and is
/// retried on the next one. Refused credentials (<see cref="ChannelFailure.Permanent"/>) mark the channel as failing
/// until someone reconnects. A single product the store refuses (<see cref="ChannelFailure.ItemRejected"/>) marks just
/// that listing and the pass carries on; it is not retried until its content changes or someone presses Sync.
/// </para>
/// </summary>
internal sealed class ChannelSyncService(
    EcommerceDbContext db,
    IChannelProviders providers,
    ISecretProtector secrets,
    IInventoryCatalogue inventory,
    ILogger<ChannelSyncService> log)
{
    // ── Credentials ───────────────────────────────────────────────────────────

    public (IChannelProvider Provider, ChannelCredentials Credentials) Connect(SalesChannel ch)
    {
        var provider = providers.Find(ch.Kind)
                       ?? throw new ChannelException($"This build cannot talk to '{ch.Kind}' stores.", ChannelFailure.Permanent);
        var token = secrets.Unprotect(ch.EncryptedToken)
                    ?? throw new ChannelException("The saved access token cannot be read any more. Enter it again.", ChannelFailure.Permanent);
        return (provider, new ChannelCredentials(ch.ShopDomain, token));
    }

    // ── One listing ───────────────────────────────────────────────────────────

    /// <summary>Creates or updates the store's product for this listing, then sets its stock. Throws <see cref="ChannelException"/> for store-wide trouble.</summary>
    public async Task PushListingAsync(SalesChannel ch, ChannelListing listing, bool forceStockSet, CancellationToken ct)
    {
        var snapshot = await inventory.GetTemplateAsync(listing.TemplateId, ct);
        if (snapshot is null)
        {
            listing.MarkFailed("The Inventory listing no longer exists.", "missing");
            return;
        }

        var hash = ContentHash(snapshot);
        var sellable = snapshot.Variants.Where(v => v.IsActive && v.SellOnline).OrderBy(v => v.Name).ToList();
        if (sellable.Count == 0)
        {
            listing.MarkFailed("No variant of this listing is active and marked to sell online.", hash);
            return;
        }

        var (provider, creds) = Connect(ch);

        var imagesKey = ImagesKey(snapshot);
        var sendImages = listing.ExternalProductId is null || listing.ImagesHash != imagesKey;
        IReadOnlyList<ProductPushImage>? images = null;
        if (sendImages)
        {
            var list = new List<ProductPushImage>();
            foreach (var img in snapshot.Images.OrderByDescending(i => i.IsPrimary).ThenBy(i => i.SortOrder))
            {
                var file = await inventory.GetImageAsync(snapshot.Id, img.Id, ct);
                if (file is not null) list.Add(new ProductPushImage(file.Data, file.FileName, img.AltText));
            }
            images = list;
        }

        var known = listing.Variants.ToDictionary(v => v.ProductId, v => v.ExternalVariantId);
        var variants = sellable.Select(v => new ProductPushVariant(
            v.ProductId, v.Sku, v.Barcode, v.SalePrice,
            snapshot.OptionNames.Select(n => v.Options.TryGetValue(n, out var val) ? val : "").ToList(),
            v.TrackInventory, v.WeightGrams, known.GetValueOrDefault(v.ProductId))).ToList();

        var active = snapshot.PublishedOnline && snapshot.IsActive;
        var push = new ProductPush(
            snapshot.Name, ToHtml(snapshot.Description ?? snapshot.ShortDescription), snapshot.BrandName, snapshot.CategoryName,
            snapshot.Tags, snapshot.Slug, active, snapshot.SeoTitle, snapshot.MetaDescription,
            snapshot.OptionNames, variants, images);

        PushedProduct pushed;
        try
        {
            pushed = await provider.UpsertProductAsync(creds, push, listing.ExternalProductId, ct);
        }
        catch (ChannelException ex) when (ex.Failure == ChannelFailure.ItemRejected)
        {
            // The product was deleted in the store behind our back: forget it so the next push creates it afresh.
            if (listing.ExternalProductId is not null && ex.Message.Contains("404"))
            {
                db.ListingVariants.RemoveRange(listing.Variants);
                listing.Variants.Clear();
                listing.ForgetStoreProduct();
            }
            listing.MarkFailed(ex.Message, hash);
            return;
        }

        // Re-point our variant rows at what the store returned.
        var returnedIds = pushed.Variants.Select(v => v.ProductId).ToHashSet();
        foreach (var gone in listing.Variants.Where(v => !returnedIds.Contains(v.ProductId)).ToList())
        {
            listing.Variants.Remove(gone);
            db.ListingVariants.Remove(gone);
        }
        foreach (var pv in pushed.Variants)
        {
            var row = listing.Variants.FirstOrDefault(v => v.ProductId == pv.ProductId);
            if (row is null)
            {
                row = new ChannelListingVariant(listing.Id, pv.ProductId, pv.ExternalVariantId, pv.ExternalInventoryItemId, pv.Sku);
                listing.Variants.Add(row);
                db.ListingVariants.Add(row);
            }
            else
            {
                // A changed store id means the variant was recreated: its stock must be set afresh.
                if (row.ExternalVariantId != pv.ExternalVariantId || row.ExternalInventoryItemId != pv.ExternalInventoryItemId) row.ForgetPushed();
                row.Update(pv.ExternalVariantId, pv.ExternalInventoryItemId, pv.Sku);
            }
        }

        listing.MarkSynced(pushed.ExternalProductId, pushed.Handle, active ? ListingStatuses.Live : ListingStatuses.Draft,
            hash, sendImages ? imagesKey : listing.ImagesHash ?? imagesKey, snapshot.Name);

        if (ch.SyncStock) await PushStockAsync(ch, listing, snapshot, provider, creds, forceStockSet, ct);
    }

    /// <summary>Sends the stock changes of one listing. Needs the channel's location to have been chosen.</summary>
    public async Task<int> PushStockAsync(
        SalesChannel ch, ChannelListing listing, TemplateSnapshot snapshot,
        IChannelProvider provider, ChannelCredentials creds, bool forceSet, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(ch.ExternalLocationId))
            throw new ChannelException("Choose which store location holds the stock before stock can be sent.", ChannelFailure.Permanent);

        var sent = 0;
        foreach (var map in listing.Variants)
        {
            if (map.ExternalInventoryItemId is null) continue;
            var variant = snapshot.Variants.FirstOrDefault(v => v.ProductId == map.ProductId);
            if (variant is null || !variant.TrackInventory) continue;

            var desired = (int)Math.Floor(Math.Max(0m, variant.StockQuantity));
            if (map.LastPushedQuantity is { } last && !forceSet)
            {
                var delta = desired - last;
                if (delta == 0) continue;
                await provider.AdjustInventoryAsync(creds, ch.ExternalLocationId, map.ExternalInventoryItemId, delta, ct);
            }
            else
            {
                await provider.SetInventoryAsync(creds, ch.ExternalLocationId, map.ExternalInventoryItemId, desired, ct);
            }
            map.RecordPushed(desired);
            sent++;
        }
        return sent;
    }

    // ── A whole channel ───────────────────────────────────────────────────────

    /// <summary>Orders first (so stock reflects what the store has already sold), then content and stock.</summary>
    public async Task<SyncResultDto> SyncChannelAsync(SalesChannel ch, bool forceStockSet, CancellationToken ct)
    {
        var errors = new List<string>();
        var orders = 0; var cancelled = 0; var pushed = 0; var stock = 0;

        try
        {
            if (ch.ImportOrders)
            {
                var (imported, cancelledCount, orderErrors) = await ImportOrdersAsync(ch, ct);
                orders = imported; cancelled = cancelledCount; errors.AddRange(orderErrors);
            }

            var listings = await db.Listings.Include(l => l.Variants)
                .Where(l => l.ChannelId == ch.Id && !l.IsDeleted)
                .ToListAsync(ct);

            var (provider, creds) = Connect(ch);
            foreach (var listing in listings)
            {
                ct.ThrowIfCancellationRequested();
                try
                {
                    var snapshot = await inventory.GetTemplateAsync(listing.TemplateId, ct);
                    if (snapshot is null)
                    {
                        listing.MarkFailed("The Inventory listing no longer exists.", "missing");
                        await db.SaveChangesAsync(ct);
                        continue;
                    }

                    var hash = ContentHash(snapshot);
                    // Content the store already refused is not sent again until it changes (or someone presses Sync).
                    var refusedBefore = listing.Status == ListingStatuses.Error && listing.FailedHash == hash;
                    var contentStale = !refusedBefore && (listing.ExternalProductId is null || ch.SyncContent && hash != listing.ContentHash);

                    if (contentStale || forceStockSet && listing.ExternalProductId is not null)
                    {
                        await PushListingAsync(ch, listing, forceStockSet, ct);
                        if (listing.Status != ListingStatuses.Error) pushed++;
                        else errors.Add($"{listing.TemplateName}: {listing.LastError}");
                    }
                    else if (ch.SyncStock && listing.ExternalProductId is not null && listing.Status is ListingStatuses.Live or ListingStatuses.Draft)
                    {
                        stock += await PushStockAsync(ch, listing, snapshot, provider, creds, false, ct);
                    }

                    await db.SaveChangesAsync(ct);
                }
                catch (ChannelException ex) when (ex.Failure == ChannelFailure.ItemRejected)
                {
                    listing.MarkFailed(ex.Message, listing.ContentHash ?? "rejected");
                    errors.Add($"{listing.TemplateName}: {ex.Message}");
                    await db.SaveChangesAsync(ct);
                }
            }

            ch.RecordSuccess(DateTime.UtcNow);
            await db.SaveChangesAsync(ct);
        }
        catch (ChannelException ex)
        {
            // Store-wide trouble: remember it on the channel and stop; the next pass tries again unless it is permanent.
            ch.RecordFailure(ex.Message);
            await db.SaveChangesAsync(CancellationToken.None);
            errors.Add(ex.Message);
            log.LogWarning("Channel {Channel} ({Kind}) sync failed: {Message}", ch.Name, ch.Kind, ex.Message);
        }

        return new SyncResultDto(pushed, stock, orders, cancelled, errors);
    }

    // ── Orders ────────────────────────────────────────────────────────────────

    public async Task<(int Imported, int Cancelled, List<string> Errors)> ImportOrdersAsync(SalesChannel ch, CancellationToken ct)
    {
        var (provider, creds) = Connect(ch);
        // A small overlap guards against an order changing in the same second the last import ended.
        var since = ch.OrdersCursor?.AddMinutes(-5);
        var fetched = await provider.FetchOrdersAsync(creds, since, ct);

        var variantMap = await db.ListingVariants
            .Where(v => db.Listings.Any(l => l.Id == v.ListingId && l.ChannelId == ch.Id && !l.IsDeleted))
            .ToListAsync(ct);

        var imported = 0; var cancelled = 0; var errors = new List<string>();

        foreach (var ext in fetched)
        {
            var existing = await db.Orders.Include(o => o.Lines)
                .FirstOrDefaultAsync(o => o.ChannelId == ch.Id && o.ExternalId == ext.ExternalId && !o.IsDeleted, ct);

            if (existing is null)
            {
                var order = new ChannelOrder(ch.Id, ext.ExternalId, ext.Number);
                order.SetDetails(ext.CustomerName, ext.Email, ext.FinancialStatus, ext.FulfillmentStatus, ext.Total, ext.CurrencyCode, ext.PlacedAt);
                db.Orders.Add(order);

                foreach (var line in ext.Lines)
                {
                    var productId = await MatchAsync(line, variantMap, ct);
                    var l = new ChannelOrderLine(order.Id, line.Title, line.Sku, line.ExternalVariantId, line.Quantity, line.UnitPrice, productId);
                    order.Lines.Add(l);
                    db.OrderLines.Add(l);
                }

                if (ext.CancelledAt is not null)
                {
                    // Cancelled before we ever saw it: nothing was sold from our point of view.
                    order.SetStatus(OrderStatuses.Cancelled);
                }
                else
                {
                    var failures = await TakeStockAsync(order, variantMap, ct);
                    errors.AddRange(failures);
                    var unmatched = order.Lines.Count(l => l.ProductId is null);
                    order.SetStatus(unmatched > 0 || failures.Count > 0 ? OrderStatuses.Unmatched : OrderStatuses.Imported,
                        unmatched > 0 ? $"{unmatched} line(s) match no Inventory product, so their stock was not touched."
                        : failures.Count > 0 ? "Stock could not be taken for some lines." : null);
                    imported++;
                }
            }
            else
            {
                existing.SetDetails(ext.CustomerName, ext.Email, ext.FinancialStatus, ext.FulfillmentStatus, ext.Total, ext.CurrencyCode, existing.PlacedAt);
                if (ext.CancelledAt is not null && existing.Status != OrderStatuses.Cancelled)
                {
                    errors.AddRange(await ReturnStockAsync(existing, variantMap, ct));
                    existing.SetStatus(OrderStatuses.Cancelled);
                    cancelled++;
                }
            }

            ch.AdvanceOrdersCursor(ext.UpdatedAt);
            await db.SaveChangesAsync(ct);
        }

        return (imported, cancelled, errors);
    }

    private async Task<Guid?> MatchAsync(ExternalOrderLine line, List<ChannelListingVariant> map, CancellationToken ct)
    {
        if (line.ExternalVariantId is not null)
        {
            var hit = map.FirstOrDefault(v => v.ExternalVariantId == line.ExternalVariantId);
            if (hit is not null) return hit.ProductId;
        }
        // A product sold in the store that we did not publish: match by SKU when exactly one Inventory product has it.
        return string.IsNullOrWhiteSpace(line.Sku) ? null : await inventory.FindProductBySkuAsync(line.Sku!, ct);
    }

    private async Task<List<string>> TakeStockAsync(ChannelOrder order, List<ChannelListingVariant> map, CancellationToken ct)
    {
        var errors = new List<string>();
        foreach (var line in order.Lines.Where(l => l.ProductId is not null && !l.StockTaken))
        {
            var r = await inventory.TakeStockAsync(line.ProductId!.Value, line.Quantity, $"SHOPIFY-{order.OrderNumber}",
                $"Online order {order.OrderNumber}", ct);
            if (r.IsFailure) { errors.Add($"{order.OrderNumber} {line.Title}: {r.Error.Description}"); continue; }

            line.MarkTaken();
            // The store already counted this sale; do not send it back to the store as a stock change.
            map.FirstOrDefault(v => v.ProductId == line.ProductId)?.ShiftPushed(-(int)Math.Ceiling(line.Quantity));
        }
        return errors;
    }

    private async Task<List<string>> ReturnStockAsync(ChannelOrder order, List<ChannelListingVariant> map, CancellationToken ct)
    {
        var errors = new List<string>();
        foreach (var line in order.Lines.Where(l => l.ProductId is not null && l.StockTaken && !l.StockReturned))
        {
            var r = await inventory.ReturnStockAsync(line.ProductId!.Value, line.Quantity, $"SHOPIFY-{order.OrderNumber}",
                $"Online order {order.OrderNumber} cancelled", ct);
            if (r.IsFailure) { errors.Add($"{order.OrderNumber} {line.Title}: {r.Error.Description}"); continue; }

            line.MarkReturned();
            // A store restocks a cancelled order by default; assume it did so the same quantity is not sent twice.
            map.FirstOrDefault(v => v.ProductId == line.ProductId)?.ShiftPushed((int)Math.Ceiling(line.Quantity));
        }
        return errors;
    }

    // ── Fingerprints and text ─────────────────────────────────────────────────

    /// <summary>Everything pushed except stock quantities. A different value means the store's copy is out of date.</summary>
    public static string ContentHash(TemplateSnapshot s)
    {
        var payload = new
        {
            s.Name, s.Description, s.ShortDescription, s.CategoryName, s.BrandName, s.Slug, s.SeoTitle, s.MetaDescription, s.Tags,
            s.OptionNames, s.PublishedOnline, s.IsActive,
            Variants = s.Variants.OrderBy(v => v.ProductId).Select(v => new
            {
                v.ProductId, v.Sku, v.Barcode, v.SalePrice, v.TrackInventory, v.IsActive, v.SellOnline, v.WeightGrams,
                Options = v.Options.OrderBy(o => o.Key).Select(o => o.Key + "=" + o.Value),
            }),
            ImagesKey = ImagesKey(s),
        };
        return Sha(JsonSerializer.Serialize(payload));
    }

    public static string ImagesKey(TemplateSnapshot s) =>
        Sha(string.Join("|", s.Images.OrderByDescending(i => i.IsPrimary).ThenBy(i => i.SortOrder).Select(i => $"{i.Id}:{i.SortOrder}:{i.IsPrimary}:{i.AltText}")));

    private static string Sha(string text) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(text)))[..40];

    /// <summary>Inventory descriptions may be plain text or HTML; the store wants HTML.</summary>
    public static string? ToHtml(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;
        if (text.Contains('<')) return text;
        return WebUtility.HtmlEncode(text).Replace("\r\n", "\n").Replace("\n", "<br>");
    }
}
