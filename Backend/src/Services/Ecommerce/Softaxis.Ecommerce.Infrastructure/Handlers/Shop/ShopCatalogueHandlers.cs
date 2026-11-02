using MediatR;
using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Ecommerce.Application.Shop;
using Softaxis.Ecommerce.Domain.Entities;
using Softaxis.Ecommerce.Infrastructure.Persistence;
using Softaxis.Ecommerce.Infrastructure.Services.Shop;
using Softaxis.Inventory.Application.Storefront;

namespace Softaxis.Ecommerce.Infrastructure.Handlers.Shop;

internal static class ShopMapping
{
    public static ShopCardDto ToCard(StorefrontCardDto c) =>
        new(c.Id, c.Name, c.Slug, c.ShortDescription, c.CategoryName, c.BrandName, c.PriceFrom, c.PriceTo, c.CoverImageId, c.InStock);

    public static IReadOnlyList<ShopPaymentMethodDto> PaymentMethods(Store s)
    {
        var list = new List<ShopPaymentMethodDto>();
        if (s.StripeEnabled && !string.IsNullOrEmpty(s.StripeSecretEnc)) list.Add(new("stripe", "Credit / debit card", null));
        if (s.PayPalEnabled && !string.IsNullOrEmpty(s.PayPalSecretEnc) && !string.IsNullOrEmpty(s.PayPalClientId)) list.Add(new("paypal", "PayPal", null));
        if (s.CodEnabled) list.Add(new("cod", "Cash on delivery", s.CodInstructions));
        if (s.BankEnabled) list.Add(new("bank", "Bank transfer", s.BankDetails));
        return list;
    }
}

internal sealed class GetShopInfoHandler(ShopGate gate, EcommerceDbContext db) : IQueryHandler<GetShopInfoQuery, ShopInfoDto>
{
    public async Task<Result<ShopInfoDto>> Handle(GetShopInfoQuery q, CancellationToken ct)
    {
        var door = await gate.OpenAsync(q.Slug, ct);
        if (door.IsFailure) return Result.Failure<ShopInfoDto>(door.Error);
        door.Value.Enter();
        var s = door.Value.Store;

        var zones = await db.ShippingZones.AsNoTracking().Where(z => z.IsActive && !z.IsDeleted).Select(z => z.CountriesJson).ToListAsync(ct);
        var countries = zones.SelectMany(ShopJson.Strings).Distinct().ToList();
        var all = countries.Contains("*");

        return Result.Success(new ShopInfoDto(
            s.Name, s.Slug, s.CurrencyCode, s.Language, s.ContactEmail, s.ContactPhone, s.Address,
            s.LogoAssetId, s.FaviconAssetId, s.AnnouncementText, s.SeoTitle, s.MetaDescription,
            s.ThemeJson, s.HeaderMenuJson, s.FooterMenuJson, s.SocialJson,
            s.TaxPercent, s.PricesIncludeTax, s.AllowGuestCheckout, s.RequirePhone,
            ShopMapping.PaymentMethods(s), all ? [] : countries.OrderBy(c => c).ToList(), all));
    }
}

internal sealed class ResolveShopHostHandler(EcommerceDbContext db, ShopLinks links) : IQueryHandler<ResolveShopHostQuery, ShopHostDto>
{
    public async Task<Result<ShopHostDto>> Handle(ResolveShopHostQuery q, CancellationToken ct)
    {
        var host = (q.Host ?? "").Trim().ToLowerInvariant();
        var colon = host.IndexOf(':'); if (colon >= 0) host = host[..colon];
        if (host.Length is 0 or > 253) return Result.Failure<ShopHostDto>(ShopErrors.NoShop);

        string? slug = null;
        foreach (var b in links.BaseDomains())
            if (host.EndsWith("." + b) && host.Length > b.Length + 1 && !host[..^(b.Length + 1)].Contains('.')) { slug = host[..^(b.Length + 1)]; break; }

        // Platform sub-domain first (cheap, no query); otherwise a store's own domain.
        if (slug is null)
            slug = await db.Stores.IgnoreQueryFilters().AsNoTracking().Where(s => s.CustomDomain == host && s.IsPublished).Select(s => s.Slug).FirstOrDefaultAsync(ct);
        if (slug is null) return Result.Failure<ShopHostDto>(ShopErrors.NoShop);
        return Result.Success(new ShopHostDto(slug));
    }
}

internal sealed class GetShopProductsHandler(ShopGate gate, EcommerceDbContext db, ISender sender)
    : IQueryHandler<GetShopProductsQuery, PagedResult<ShopCardDto>>
{
    public async Task<Result<PagedResult<ShopCardDto>>> Handle(GetShopProductsQuery q, CancellationToken ct)
    {
        var door = await gate.OpenAsync(q.Slug, ct);
        if (door.IsFailure) return Result.Failure<PagedResult<ShopCardDto>>(door.Error);
        door.Value.Enter();

        string? category = string.IsNullOrWhiteSpace(q.Category) ? null : q.Category.Trim();
        IReadOnlyList<Guid>? ids = null;
        if (!string.IsNullOrWhiteSpace(q.Collection))
        {
            var slug = q.Collection.Trim().ToLowerInvariant();
            var col = await db.Collections.AsNoTracking().FirstOrDefaultAsync(c => c.Slug == slug && c.IsPublished && !c.IsDeleted, ct);
            if (col is null) return Result.Success(PagedResult<ShopCardDto>.Create([], 0, 1, Math.Clamp(q.PageSize, 1, 60)));
            if (!string.IsNullOrWhiteSpace(col.CategoryName)) category = col.CategoryName;
            else
            {
                ids = ShopJson.Guids(col.TemplateIdsJson);
                if (ids.Count == 0) return Result.Success(PagedResult<ShopCardDto>.Create([], 0, 1, Math.Clamp(q.PageSize, 1, 60)));
            }
        }

        var r = await sender.Send(new GetStorefrontProductsQuery(q.Search, category, ids, q.Sort, q.Page, q.PageSize), ct);
        if (r.IsFailure) return Result.Failure<PagedResult<ShopCardDto>>(r.Error);
        return Result.Success(PagedResult<ShopCardDto>.Create(r.Value.Items.Select(ShopMapping.ToCard).ToList(), r.Value.TotalCount, r.Value.Page, r.Value.PageSize));
    }
}

internal sealed class GetShopProductHandler(ShopGate gate, ISender sender) : IQueryHandler<GetShopProductQuery, ShopProductDto>
{
    public async Task<Result<ShopProductDto>> Handle(GetShopProductQuery q, CancellationToken ct)
    {
        var door = await gate.OpenAsync(q.Slug, ct);
        if (door.IsFailure) return Result.Failure<ShopProductDto>(door.Error);
        door.Value.Enter();

        var r = await sender.Send(new GetStorefrontProductQuery(q.ProductSlug), ct);
        if (r.IsFailure) return Result.Failure<ShopProductDto>(ShopErrors.NoProduct);
        var p = r.Value;

        var related = await sender.Send(new GetStorefrontProductsQuery(null, p.CategoryName, null, "newest", 1, 5), ct);
        var cards = related.IsSuccess ? related.Value.Items.Where(c => c.Id != p.Id).Take(4).Select(ShopMapping.ToCard).ToList() : [];

        return Result.Success(new ShopProductDto(
            p.Id, p.Name, p.Slug, p.Description, p.ShortDescription, p.CategoryName, p.BrandName, p.SeoTitle, p.MetaDescription,
            p.Options.Select(o => new ShopOptionDto(o.Name, o.Values)).ToList(),
            p.Variants.Select(v => new ShopVariantDto(
                v.ProductId, v.Name, v.Sku, v.Options, v.Price,
                !v.TrackInventory || v.Stock > 0,
                // Only say how many are left when it is few — a big number is no help to the shopper and tells a rival our stock.
                v.TrackInventory && v.Stock > 0 && v.Stock <= 10 ? (int)Math.Floor(v.Stock) : null)).ToList(),
            p.Images.Select(i => new ShopImageDto(i.Id, i.ProductId, i.Alt)).ToList(), cards));
    }
}

internal sealed class GetShopCategoriesHandler(ShopGate gate, ISender sender) : IQueryHandler<GetShopCategoriesQuery, IReadOnlyList<ShopCategoryDto>>
{
    public async Task<Result<IReadOnlyList<ShopCategoryDto>>> Handle(GetShopCategoriesQuery q, CancellationToken ct)
    {
        var door = await gate.OpenAsync(q.Slug, ct);
        if (door.IsFailure) return Result.Failure<IReadOnlyList<ShopCategoryDto>>(door.Error);
        door.Value.Enter();
        var r = await sender.Send(new GetStorefrontCategoriesQuery(), ct);
        if (r.IsFailure) return Result.Failure<IReadOnlyList<ShopCategoryDto>>(r.Error);
        IReadOnlyList<ShopCategoryDto> list = r.Value.Select(c => new ShopCategoryDto(c.Name, c.Count)).ToList();
        return Result.Success(list);
    }
}

internal sealed class GetShopCollectionsHandler(ShopGate gate, EcommerceDbContext db) : IQueryHandler<GetShopCollectionsQuery, IReadOnlyList<ShopCollectionDto>>
{
    public async Task<Result<IReadOnlyList<ShopCollectionDto>>> Handle(GetShopCollectionsQuery q, CancellationToken ct)
    {
        var door = await gate.OpenAsync(q.Slug, ct);
        if (door.IsFailure) return Result.Failure<IReadOnlyList<ShopCollectionDto>>(door.Error);
        door.Value.Enter();
        var rows = await db.Collections.AsNoTracking().Where(c => c.IsPublished && !c.IsDeleted).OrderBy(c => c.SortOrder).ThenBy(c => c.Name).ToListAsync(ct);
        IReadOnlyList<ShopCollectionDto> list = rows.Select(c => new ShopCollectionDto(c.Slug, c.Name, c.Description, c.ImageAssetId)).ToList();
        return Result.Success(list);
    }
}

internal sealed class GetShopPageHandler(ShopGate gate, EcommerceDbContext db) : IQueryHandler<GetShopPageQuery, ShopPageDto>
{
    public async Task<Result<ShopPageDto>> Handle(GetShopPageQuery q, CancellationToken ct)
    {
        var door = await gate.OpenAsync(q.Slug, ct);
        if (door.IsFailure) return Result.Failure<ShopPageDto>(door.Error);
        door.Value.Enter();
        var slug = (q.PageSlug ?? "").Trim().ToLowerInvariant();
        var p = await db.Pages.AsNoTracking().FirstOrDefaultAsync(x => x.Slug == slug && x.IsPublished && !x.IsDeleted, ct);
        return p is null
            ? Result.Failure<ShopPageDto>(Error.Custom("Page.NotFound", "That page does not exist."))
            : Result.Success(new ShopPageDto(p.Slug, p.Title, p.Kind, p.SectionsJson, p.SeoTitle, p.MetaDescription));
    }
}

internal sealed class GetShopSitemapHandler(ShopGate gate, EcommerceDbContext db, ISender sender, ShopLinks links)
    : IQueryHandler<GetShopSitemapQuery, IReadOnlyList<string>>
{
    public async Task<Result<IReadOnlyList<string>>> Handle(GetShopSitemapQuery q, CancellationToken ct)
    {
        var door = await gate.OpenAsync(q.Slug, ct);
        if (door.IsFailure) return Result.Failure<IReadOnlyList<string>>(door.Error);
        door.Value.Enter();
        var store = door.Value.Store;

        var urls = new List<string> { links.ShopUrl(store, q.Origin, "/"), links.ShopUrl(store, q.Origin, "/products") };
        foreach (var c in await db.Collections.AsNoTracking().Where(c => c.IsPublished && !c.IsDeleted).Select(c => c.Slug).ToListAsync(ct))
            urls.Add(links.ShopUrl(store, q.Origin, "/collections/" + c));
        foreach (var p in await db.Pages.AsNoTracking().Where(p => p.IsPublished && !p.IsDeleted && p.Kind != "home").Select(p => p.Slug).ToListAsync(ct))
            urls.Add(links.ShopUrl(store, q.Origin, "/pages/" + p));

        for (var page = 1; page <= 20; page++)   // up to 2,000 products — the sitemap protocol allows 50,000 but a store this big needs an index file
        {
            var r = await sender.Send(new GetStorefrontProductsQuery(null, null, null, "newest", page, 60), ct);
            if (r.IsFailure) break;
            urls.AddRange(r.Value.Items.Select(i => links.ShopUrl(store, q.Origin, "/products/" + i.Slug)));
            if (page >= r.Value.TotalPages) break;
        }
        return Result.Success<IReadOnlyList<string>>(urls);
    }
}

internal sealed class GetShopQuoteHandler(ShopGate gate, StorePricing pricing) : IQueryHandler<GetShopQuoteQuery, ShopQuoteDto>
{
    public async Task<Result<ShopQuoteDto>> Handle(GetShopQuoteQuery q, CancellationToken ct)
    {
        var door = await gate.OpenAsync(q.Slug, ct);
        if (door.IsFailure) return Result.Failure<ShopQuoteDto>(door.Error);
        door.Value.Enter();
        var store = door.Value.Store;

        if (q.Items.Count > 100) return Result.Failure<ShopQuoteDto>(ShopErrors.Invalid("The cart is too large."));
        var cart = await pricing.QuoteAsync(store, q.Items, q.DiscountCode, q.Country, q.ZoneId, ct);
        return Result.Success(ShopQuote.ToDto(store, cart));
    }
}

internal static class ShopQuote
{
    public static ShopQuoteDto ToDto(Store store, PricedCart c)
    {
        var cur = store.CurrencyCode;
        var lines = c.Lines.Select(l => new ShopQuoteLineDto(
            l.Variant.ProductId, l.Variant.TemplateSlug, l.Variant.TemplateName,
            string.Equals(l.Variant.VariantName, l.Variant.TemplateName, StringComparison.OrdinalIgnoreCase) ? null : l.Variant.VariantName,
            l.Variant.Sku, l.Variant.TemplateId, l.Variant.CoverImageId,
            Money.Round(l.Variant.Price, cur), l.Quantity, l.Problem is null ? l.LineTotal(cur) : 0, l.MaxQuantity, l.Problem)).ToList();

        string? blocked = null;
        if (c.Lines.Count == 0) blocked = "Your cart is empty.";
        else if (c.HasProblems) blocked = "Some items in your cart need attention.";
        return new ShopQuoteDto(lines, c.Subtotal, c.DiscountTotal, c.Discount?.Code, c.DiscountError, c.Options, c.SelectedZoneId,
            c.ShippingTotal, c.TaxTotal, c.Total, cur, blocked is null, blocked);
    }
}
