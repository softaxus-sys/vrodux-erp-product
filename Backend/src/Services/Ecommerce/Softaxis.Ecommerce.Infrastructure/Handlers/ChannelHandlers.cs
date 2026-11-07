using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Ecommerce.Application.Abstractions;
using Softaxis.Ecommerce.Application.Channels;
using Softaxis.Ecommerce.Domain.Entities;
using Softaxis.Ecommerce.Infrastructure.Persistence;
using Softaxis.Ecommerce.Infrastructure.Services;

namespace Softaxis.Ecommerce.Infrastructure.Handlers;

internal static class ChannelErrors
{
    public static readonly Error NotFound = Error.Custom("Channel.NotFound", "That store was not found.");
    public static readonly Error ListingNotFound = Error.Custom("Listing.NotFound", "That listing was not found.");

    /// <summary>
    /// A store that cannot be reached right now is "unavailable" (try later, 503). Anything a person has to fix —
    /// refused credentials, a missing permission, a product the store will not take — is a conflict (409).
    /// </summary>
    public static Error From(ChannelException ex) => ex.Failure == ChannelFailure.Transient
        ? Error.Custom("Channel.Unavailable", ex.Message)
        : Error.Custom("Channel.Conflict", ex.Message);

    public static string NormaliseDomain(string input)
    {
        var d = input.Trim();
        foreach (var prefix in new[] { "https://", "http://" })
            if (d.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)) d = d[prefix.Length..];
        var slash = d.IndexOf('/');
        if (slash >= 0) d = d[..slash];
        return d.ToLowerInvariant();
    }
}

internal static class ChannelMapping
{
    public static async Task<List<ChannelDto>> ToDtosAsync(EcommerceDbContext db, IReadOnlyList<SalesChannel> channels, CancellationToken ct)
    {
        var ids = channels.Select(c => c.Id).ToList();
        var listings = await db.Listings.Where(l => !l.IsDeleted && ids.Contains(l.ChannelId))
            .GroupBy(l => new { l.ChannelId, l.Status }).Select(g => new { g.Key.ChannelId, g.Key.Status, N = g.Count() }).ToListAsync(ct);
        var orders = await db.Orders.Where(o => !o.IsDeleted && ids.Contains(o.ChannelId))
            .GroupBy(o => o.ChannelId).Select(g => new { ChannelId = g.Key, N = g.Count() }).ToListAsync(ct);

        return channels.Select(c => new ChannelDto(
            c.Id, c.Kind, c.Name, c.ShopDomain, c.Status, c.ExternalLocationId, c.LocationName, c.CurrencyCode,
            c.SyncStock, c.SyncContent, c.ImportOrders, c.LastSyncAt, c.LastError, c.ConsecutiveFailures,
            listings.Where(l => l.ChannelId == c.Id && l.Status == ListingStatuses.Live).Sum(l => l.N),
            listings.Where(l => l.ChannelId == c.Id && l.Status == ListingStatuses.Error).Sum(l => l.N),
            orders.FirstOrDefault(o => o.ChannelId == c.Id)?.N ?? 0,
            c.CreatedAt)).ToList();
    }

    public static async Task<ChannelDto> ToDtoAsync(EcommerceDbContext db, SalesChannel c, CancellationToken ct)
        => (await ToDtosAsync(db, [c], ct))[0];

    public static ListingDto ToDto(ChannelListing l, SalesChannel ch) => new(
        l.Id, l.ChannelId, ch.Name, l.TemplateId, l.TemplateName, l.ExternalProductId,
        l.ExternalProductId is null ? null : AdminUrl(ch, l.ExternalProductId),
        l.Status, l.LastError, l.LastSyncedAt, l.Variants.Count, l.CreatedAt);

    private static string? AdminUrl(SalesChannel ch, string productId) =>
        ch.Kind == ChannelKinds.Shopify ? $"https://{ch.ShopDomain}/admin/products/{productId}" : null;
}

// ── Queries ───────────────────────────────────────────────────────────────────

internal sealed class GetProvidersHandler(IChannelProviders providers) : IQueryHandler<GetProvidersQuery, IReadOnlyList<ProviderInfo>>
{
    public Task<Result<IReadOnlyList<ProviderInfo>>> Handle(GetProvidersQuery q, CancellationToken ct)
        => Task.FromResult(Result.Success(providers.All));
}

internal sealed class GetChannelsHandler(EcommerceDbContext db) : IQueryHandler<GetChannelsQuery, IReadOnlyList<ChannelDto>>
{
    public async Task<Result<IReadOnlyList<ChannelDto>>> Handle(GetChannelsQuery q, CancellationToken ct)
    {
        var channels = await db.Channels.AsNoTracking().Where(c => !c.IsDeleted).OrderBy(c => c.Name).ToListAsync(ct);
        return Result.Success<IReadOnlyList<ChannelDto>>(await ChannelMapping.ToDtosAsync(db, channels, ct));
    }
}

internal sealed class GetChannelByIdHandler(EcommerceDbContext db) : IQueryHandler<GetChannelByIdQuery, ChannelDto>
{
    public async Task<Result<ChannelDto>> Handle(GetChannelByIdQuery q, CancellationToken ct)
    {
        var c = await db.Channels.AsNoTracking().FirstOrDefaultAsync(x => x.Id == q.Id && !x.IsDeleted, ct);
        return c is null ? Result.Failure<ChannelDto>(ChannelErrors.NotFound) : Result.Success(await ChannelMapping.ToDtoAsync(db, c, ct));
    }
}

internal sealed class GetChannelLocationsHandler(EcommerceDbContext db, ChannelSyncService sync)
    : IQueryHandler<GetChannelLocationsQuery, IReadOnlyList<LocationDto>>
{
    public async Task<Result<IReadOnlyList<LocationDto>>> Handle(GetChannelLocationsQuery q, CancellationToken ct)
    {
        var ch = await db.Channels.AsNoTracking().FirstOrDefaultAsync(x => x.Id == q.Id && !x.IsDeleted, ct);
        if (ch is null) return Result.Failure<IReadOnlyList<LocationDto>>(ChannelErrors.NotFound);
        try
        {
            var (provider, creds) = sync.Connect(ch);
            var locations = await provider.GetLocationsAsync(creds, ct);
            return Result.Success<IReadOnlyList<LocationDto>>(locations.Select(l => new LocationDto(l.Id, l.Name, l.Active)).ToList());
        }
        catch (ChannelException ex) { return Result.Failure<IReadOnlyList<LocationDto>>(ChannelErrors.From(ex)); }
    }
}

internal sealed class GetListingsHandler(EcommerceDbContext db) : IQueryHandler<GetListingsQuery, IReadOnlyList<ListingDto>>
{
    public async Task<Result<IReadOnlyList<ListingDto>>> Handle(GetListingsQuery q, CancellationToken ct)
    {
        var channels = await db.Channels.AsNoTracking().Where(c => !c.IsDeleted).ToDictionaryAsync(c => c.Id, ct);
        var query = db.Listings.AsNoTracking().Include(l => l.Variants).Where(l => !l.IsDeleted);
        if (q.ChannelId is { } cid) query = query.Where(l => l.ChannelId == cid);
        if (q.TemplateId is { } tid) query = query.Where(l => l.TemplateId == tid);

        var list = await query.OrderBy(l => l.TemplateName).ToListAsync(ct);
        return Result.Success<IReadOnlyList<ListingDto>>(list
            .Where(l => channels.ContainsKey(l.ChannelId))
            .Select(l => ChannelMapping.ToDto(l, channels[l.ChannelId])).ToList());
    }
}

internal sealed class GetChannelOrdersHandler(EcommerceDbContext db) : IQueryHandler<GetChannelOrdersQuery, PagedResult<ChannelOrderDto>>
{
    public async Task<Result<PagedResult<ChannelOrderDto>>> Handle(GetChannelOrdersQuery q, CancellationToken ct)
    {
        var channels = await db.Channels.AsNoTracking().Where(c => !c.IsDeleted).ToDictionaryAsync(c => c.Id, c => c.Name, ct);
        var query = db.Orders.AsNoTracking().Include(o => o.Lines).Where(o => !o.IsDeleted);
        if (q.ChannelId is { } cid) query = query.Where(o => o.ChannelId == cid);
        if (!string.IsNullOrWhiteSpace(q.Status)) query = query.Where(o => o.Status == q.Status);
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim();
            query = query.Where(o => o.OrderNumber.Contains(s) || (o.CustomerName != null && o.CustomerName.Contains(s)) || (o.Email != null && o.Email.Contains(s)));
        }

        var total = await query.CountAsync(ct);
        var page = Math.Max(1, q.Page); var size = Math.Clamp(q.PageSize, 1, 100);
        var rows = await query.OrderByDescending(o => o.PlacedAt).Skip((page - 1) * size).Take(size).ToListAsync(ct);

        var items = rows.Select(o => new ChannelOrderDto(
            o.Id, o.ChannelId, channels.GetValueOrDefault(o.ChannelId, "Removed store"), o.ExternalId, o.OrderNumber, o.Status,
            o.CustomerName, o.Email, o.FinancialStatus, o.FulfillmentStatus, o.Total, o.CurrencyCode, o.PlacedAt, o.ImportedAt, o.Note,
            o.Lines.Select(l => new OrderLineDto(l.Title, l.Sku, l.Quantity, l.UnitPrice, l.ProductId, l.StockTaken, l.StockReturned)).ToList())).ToList();

        return Result.Success(PagedResult<ChannelOrderDto>.Create(items, total, page, size));
    }
}

internal sealed class SearchTemplatesHandler(IInventoryCatalogue inventory) : IQueryHandler<SearchTemplatesQuery, IReadOnlyList<TemplateLookupDto>>
{
    public async Task<Result<IReadOnlyList<TemplateLookupDto>>> Handle(SearchTemplatesQuery q, CancellationToken ct)
    {
        var list = await inventory.SearchTemplatesAsync(q.Search, 30, ct);
        return Result.Success<IReadOnlyList<TemplateLookupDto>>(list
            .Select(t => new TemplateLookupDto(t.Id, t.Name, t.VariantCount, t.TotalStock, t.PublishedOnline, t.IsActive)).ToList());
    }
}

// ── Channel commands ──────────────────────────────────────────────────────────

internal sealed class ConnectChannelHandler(EcommerceDbContext db, IChannelProviders providers, ISecretProtector secrets)
    : ICommandHandler<ConnectChannelCommand, ChannelDto>
{
    public async Task<Result<ChannelDto>> Handle(ConnectChannelCommand cmd, CancellationToken ct)
    {
        var provider = providers.Find(cmd.Kind);
        if (provider is null || providers.All.FirstOrDefault(p => p.Kind == cmd.Kind)?.Available != true)
            return Result.Failure<ChannelDto>(Error.Custom("Channel.Conflict", "That kind of store cannot be connected yet."));

        var domain = ChannelErrors.NormaliseDomain(cmd.ShopDomain);
        if (await db.Channels.AnyAsync(c => !c.IsDeleted && c.Kind == cmd.Kind && c.ShopDomain == domain, ct))
            return Result.Failure<ChannelDto>(Error.Custom("Channel.Duplicate", "That store is already connected."));

        var creds = new ChannelCredentials(domain, cmd.AccessToken.Trim());
        ShopInfo shop;
        IReadOnlyList<ChannelLocation> locations = [];
        try
        {
            // Proves the address and token work, and the scopes cover what we need, before anything is saved.
            shop = await provider.VerifyAsync(creds, ct);
            locations = await provider.GetLocationsAsync(creds, ct);
        }
        catch (ChannelException ex) { return Result.Failure<ChannelDto>(ChannelErrors.From(ex)); }

        var channel = new SalesChannel(cmd.Kind, string.IsNullOrWhiteSpace(cmd.Name) ? shop.Name : cmd.Name, domain, secrets.Protect(cmd.AccessToken.Trim()));
        channel.SetCurrency(shop.CurrencyCode);
        // Only orders from now on are imported: earlier ones are not in Inventory's stock figures, so taking them out would double-count.
        channel.AdvanceOrdersCursor(DateTime.UtcNow);

        var active = locations.Where(l => l.Active).ToList();
        if (active.Count == 1) channel.SetLocation(active[0].Id, active[0].Name);

        db.Channels.Add(channel);
        await db.SaveChangesAsync(ct);
        return Result.Success(await ChannelMapping.ToDtoAsync(db, channel, ct));
    }
}

internal sealed class UpdateChannelHandler(EcommerceDbContext db, ChannelSyncService sync) : ICommandHandler<UpdateChannelCommand, ChannelDto>
{
    public async Task<Result<ChannelDto>> Handle(UpdateChannelCommand cmd, CancellationToken ct)
    {
        var ch = await db.Channels.FirstOrDefaultAsync(c => c.Id == cmd.Id && !c.IsDeleted, ct);
        if (ch is null) return Result.Failure<ChannelDto>(ChannelErrors.NotFound);

        ch.Rename(cmd.Name);
        ch.Configure(cmd.SyncStock, cmd.SyncContent, cmd.ImportOrders);
        if (cmd.Paused) ch.Pause(); else if (ch.Status == ChannelStatuses.Paused) ch.Resume();

        if (!string.IsNullOrWhiteSpace(cmd.LocationId) && cmd.LocationId != ch.ExternalLocationId)
        {
            string? name = null;
            try
            {
                var (provider, creds) = sync.Connect(ch);
                name = (await provider.GetLocationsAsync(creds, ct)).FirstOrDefault(l => l.Id == cmd.LocationId)?.Name;
            }
            catch (ChannelException ex) { return Result.Failure<ChannelDto>(ChannelErrors.From(ex)); }

            if (name is null) return Result.Failure<ChannelDto>(Error.Custom("Channel.Conflict", "That location does not exist in the store."));
            ch.SetLocation(cmd.LocationId, name);

            // Stock levels belong to a location: the remembered levels are for the old one, so start again at the new one.
            var variants = await db.ListingVariants.Where(v => db.Listings.Any(l => l.Id == v.ListingId && l.ChannelId == ch.Id)).ToListAsync(ct);
            foreach (var v in variants) v.ForgetPushed();
        }

        await db.SaveChangesAsync(ct);
        return Result.Success(await ChannelMapping.ToDtoAsync(db, ch, ct));
    }
}

internal sealed class ReplaceChannelTokenHandler(EcommerceDbContext db, IChannelProviders providers, ISecretProtector secrets)
    : ICommandHandler<ReplaceChannelTokenCommand, ChannelDto>
{
    public async Task<Result<ChannelDto>> Handle(ReplaceChannelTokenCommand cmd, CancellationToken ct)
    {
        var ch = await db.Channels.FirstOrDefaultAsync(c => c.Id == cmd.Id && !c.IsDeleted, ct);
        if (ch is null) return Result.Failure<ChannelDto>(ChannelErrors.NotFound);
        var provider = providers.Find(ch.Kind);
        if (provider is null) return Result.Failure<ChannelDto>(ChannelErrors.NotFound);

        try { await provider.VerifyAsync(new ChannelCredentials(ch.ShopDomain, cmd.AccessToken.Trim()), ct); }
        catch (ChannelException ex) { return Result.Failure<ChannelDto>(ChannelErrors.From(ex)); }

        ch.ReplaceToken(secrets.Protect(cmd.AccessToken.Trim()));
        await db.SaveChangesAsync(ct);
        return Result.Success(await ChannelMapping.ToDtoAsync(db, ch, ct));
    }
}

internal sealed class DeleteChannelHandler(EcommerceDbContext db) : ICommandHandler<DeleteChannelCommand>
{
    public async Task<Result> Handle(DeleteChannelCommand cmd, CancellationToken ct)
    {
        var ch = await db.Channels.FirstOrDefaultAsync(c => c.Id == cmd.Id && !c.IsDeleted, ct);
        if (ch is null) return Result.Failure(ChannelErrors.NotFound);

        var listings = await db.Listings.Include(l => l.Variants).Where(l => l.ChannelId == ch.Id && !l.IsDeleted).ToListAsync(ct);
        foreach (var l in listings) { db.ListingVariants.RemoveRange(l.Variants); l.Delete(); }
        ch.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class SyncChannelHandler(EcommerceDbContext db, ChannelSyncService sync) : ICommandHandler<SyncChannelCommand, SyncResultDto>
{
    public async Task<Result<SyncResultDto>> Handle(SyncChannelCommand cmd, CancellationToken ct)
    {
        var ch = await db.Channels.FirstOrDefaultAsync(c => c.Id == cmd.Id && !c.IsDeleted, ct);
        if (ch is null) return Result.Failure<SyncResultDto>(ChannelErrors.NotFound);
        if (ch.Status == ChannelStatuses.Paused) return Result.Failure<SyncResultDto>(Error.Custom("Channel.Conflict", "This store is paused. Resume it first."));
        return Result.Success(await sync.SyncChannelAsync(ch, cmd.ResetStock, ct));
    }
}

internal sealed class ImportChannelOrdersHandler(EcommerceDbContext db, ChannelSyncService sync) : ICommandHandler<ImportChannelOrdersCommand, SyncResultDto>
{
    public async Task<Result<SyncResultDto>> Handle(ImportChannelOrdersCommand cmd, CancellationToken ct)
    {
        var ch = await db.Channels.FirstOrDefaultAsync(c => c.Id == cmd.ChannelId && !c.IsDeleted, ct);
        if (ch is null) return Result.Failure<SyncResultDto>(ChannelErrors.NotFound);
        try
        {
            var (imported, cancelled, errors) = await sync.ImportOrdersAsync(ch, ct);
            await db.SaveChangesAsync(ct);
            return Result.Success(new SyncResultDto(0, 0, imported, cancelled, errors));
        }
        catch (ChannelException ex) { return Result.Failure<SyncResultDto>(ChannelErrors.From(ex)); }
    }
}

// ── Listing commands ──────────────────────────────────────────────────────────

internal sealed class PublishListingHandler(EcommerceDbContext db, ChannelSyncService sync, IInventoryCatalogue inventory)
    : ICommandHandler<PublishListingCommand, ListingDto>
{
    public async Task<Result<ListingDto>> Handle(PublishListingCommand cmd, CancellationToken ct)
    {
        var ch = await db.Channels.FirstOrDefaultAsync(c => c.Id == cmd.ChannelId && !c.IsDeleted, ct);
        if (ch is null) return Result.Failure<ListingDto>(ChannelErrors.NotFound);
        if (ch.Status == ChannelStatuses.Paused) return Result.Failure<ListingDto>(Error.Custom("Channel.Conflict", "This store is paused. Resume it first."));
        if (ch.SyncStock && string.IsNullOrEmpty(ch.ExternalLocationId))
            return Result.Failure<ListingDto>(Error.Custom("Channel.Conflict", "Choose which store location holds the stock first (store settings)."));

        var snapshot = await inventory.GetTemplateAsync(cmd.TemplateId, ct);
        if (snapshot is null) return Result.Failure<ListingDto>(Error.Custom("Listing.NotFound", "That Inventory listing was not found."));
        if (!snapshot.IsActive || !snapshot.PublishedOnline)
            return Result.Failure<ListingDto>(Error.Custom("Listing.Conflict", "Publish this listing in Inventory → Online Listings first; only published listings can go to a store."));

        if (await db.Listings.AnyAsync(l => !l.IsDeleted && l.ChannelId == ch.Id && l.TemplateId == cmd.TemplateId, ct))
            return Result.Failure<ListingDto>(Error.Custom("Listing.Duplicate", "This listing is already in that store."));

        var listing = new ChannelListing(ch.Id, cmd.TemplateId, snapshot.Name);
        db.Listings.Add(listing);
        await db.SaveChangesAsync(ct);   // saved before the store is called, so a failure leaves a visible, retryable listing

        try
        {
            await sync.PushListingAsync(ch, listing, forceStockSet: true, ct);
            await db.SaveChangesAsync(ct);
        }
        catch (ChannelException ex)
        {
            // Store-wide trouble: keep the pending listing; the background sync retries it.
            if (ex.Permanent) ch.RecordFailure(ex.Message);
            await db.SaveChangesAsync(CancellationToken.None);
            return Result.Failure<ListingDto>(ChannelErrors.From(ex));
        }

        return Result.Success(ChannelMapping.ToDto(listing, ch));
    }
}

internal sealed class SyncListingHandler(EcommerceDbContext db, ChannelSyncService sync) : ICommandHandler<SyncListingCommand, ListingDto>
{
    public async Task<Result<ListingDto>> Handle(SyncListingCommand cmd, CancellationToken ct)
    {
        var listing = await db.Listings.Include(l => l.Variants).FirstOrDefaultAsync(l => l.Id == cmd.ListingId && !l.IsDeleted, ct);
        if (listing is null) return Result.Failure<ListingDto>(ChannelErrors.ListingNotFound);
        var ch = await db.Channels.FirstOrDefaultAsync(c => c.Id == listing.ChannelId && !c.IsDeleted, ct);
        if (ch is null) return Result.Failure<ListingDto>(ChannelErrors.NotFound);

        try
        {
            await sync.PushListingAsync(ch, listing, forceStockSet: false, ct);
            await db.SaveChangesAsync(ct);
        }
        catch (ChannelException ex)
        {
            if (ex.Permanent) ch.RecordFailure(ex.Message);
            await db.SaveChangesAsync(CancellationToken.None);
            return Result.Failure<ListingDto>(ChannelErrors.From(ex));
        }
        return Result.Success(ChannelMapping.ToDto(listing, ch));
    }
}

internal sealed class UnpublishListingHandler(EcommerceDbContext db, ChannelSyncService sync) : ICommandHandler<UnpublishListingCommand, ListingDto>
{
    public async Task<Result<ListingDto>> Handle(UnpublishListingCommand cmd, CancellationToken ct)
    {
        var listing = await db.Listings.Include(l => l.Variants).FirstOrDefaultAsync(l => l.Id == cmd.ListingId && !l.IsDeleted, ct);
        if (listing is null) return Result.Failure<ListingDto>(ChannelErrors.ListingNotFound);
        var ch = await db.Channels.FirstOrDefaultAsync(c => c.Id == listing.ChannelId && !c.IsDeleted, ct);
        if (ch is null) return Result.Failure<ListingDto>(ChannelErrors.NotFound);
        if (listing.ExternalProductId is null) return Result.Failure<ListingDto>(Error.Custom("Listing.Conflict", "This listing has not reached the store yet."));

        try
        {
            var (provider, creds) = sync.Connect(ch);
            await provider.SetProductActiveAsync(creds, listing.ExternalProductId, false, ct);
        }
        catch (ChannelException ex) { return Result.Failure<ListingDto>(ChannelErrors.From(ex)); }

        listing.SetStatus(ListingStatuses.Draft);
        await db.SaveChangesAsync(ct);
        return Result.Success(ChannelMapping.ToDto(listing, ch));
    }
}

internal sealed class RemoveListingHandler(EcommerceDbContext db, ChannelSyncService sync) : ICommandHandler<RemoveListingCommand>
{
    public async Task<Result> Handle(RemoveListingCommand cmd, CancellationToken ct)
    {
        var listing = await db.Listings.Include(l => l.Variants).FirstOrDefaultAsync(l => l.Id == cmd.ListingId && !l.IsDeleted, ct);
        if (listing is null) return Result.Failure(ChannelErrors.ListingNotFound);

        if (cmd.DeleteInStore && listing.ExternalProductId is not null)
        {
            var ch = await db.Channels.FirstOrDefaultAsync(c => c.Id == listing.ChannelId && !c.IsDeleted, ct);
            if (ch is not null)
            {
                try
                {
                    var (provider, creds) = sync.Connect(ch);
                    await provider.DeleteProductAsync(creds, listing.ExternalProductId, ct);
                }
                catch (ChannelException ex) { return Result.Failure(ChannelErrors.From(ex)); }
            }
        }

        db.ListingVariants.RemoveRange(listing.Variants);
        listing.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
