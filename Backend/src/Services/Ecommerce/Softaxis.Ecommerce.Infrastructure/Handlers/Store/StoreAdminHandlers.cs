using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Ecommerce.Application.Abstractions;
using Softaxis.Ecommerce.Application.StoreAdmin;
using Softaxis.Ecommerce.Domain.Entities;
using Softaxis.Ecommerce.Infrastructure.Persistence;
using Softaxis.Ecommerce.Infrastructure.Services.Shop;

namespace Softaxis.Ecommerce.Infrastructure.Handlers.StoreAdmin;

internal static class StoreErrors
{
    public static readonly Error NoStore = Error.Custom("Store.NotFound", "Set up your store first.");
    public static Error NotFound(string what) => Error.Custom($"{what}.NotFound", $"That {what.ToLowerInvariant()} was not found.");
    public static Error Duplicate(string message) => Error.Custom("Store.Duplicate", message);
    public static Error Invalid(string message) => Error.Custom("Validation.Failed", message);
}

internal static class StoreMapping
{
    private static readonly Regex Domain = new(@"^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$", RegexOptions.Compiled);

    public static StoreSettingsDto ToDto(Store s, ShopLinks links) => new(
        s.Id, s.Name, s.Slug, s.CustomDomain, s.IsPublished, s.CurrencyCode, s.Language,
        s.ContactEmail, s.ContactPhone, s.Address, s.OrderNotifyEmail,
        s.LogoAssetId, s.FaviconAssetId, s.AnnouncementText, s.SeoTitle, s.MetaDescription,
        s.ThemeJson, s.HeaderMenuJson, s.FooterMenuJson, s.SocialJson,
        s.TaxPercent, s.PricesIncludeTax, s.AllowGuestCheckout, s.RequirePhone,
        s.CodEnabled, s.CodInstructions, s.BankEnabled, s.BankDetails,
        s.StripeEnabled, !string.IsNullOrEmpty(s.StripeSecretEnc), !string.IsNullOrEmpty(s.StripeWebhookSecretEnc),
        s.PayPalEnabled, s.PayPalClientId, !string.IsNullOrEmpty(s.PayPalSecretEnc), s.PayPalSandbox,
        links.ShopUrl(s, null), links.ApiUrl($"/api/ecommerce/shop/{s.Slug}/webhooks/stripe"));

    /// <summary>Lower-case, no scheme, path or port; null when blank.</summary>
    public static string? NormaliseDomain(string? input)
    {
        if (string.IsNullOrWhiteSpace(input)) return null;
        var d = input.Trim().ToLowerInvariant();
        foreach (var p in new[] { "https://", "http://" }) if (d.StartsWith(p)) d = d[p.Length..];
        var cut = d.IndexOfAny(['/', '?', '#', ':']);
        if (cut >= 0) d = d[..cut];
        return d.TrimEnd('.');
    }

    public static bool IsValidDomain(string d) => d.Length <= 253 && Domain.IsMatch(d);

    /// <summary>A "javascript:" (or other script-bearing) link anywhere in builder content would run in a shopper's browser.</summary>
    public static bool HasScriptUrl(JsonElement e)
    {
        switch (e.ValueKind)
        {
            case JsonValueKind.String:
                var s = (e.GetString() ?? "").TrimStart().ToLowerInvariant();
                return s.StartsWith("javascript:") || s.StartsWith("data:text/html") || s.StartsWith("vbscript:");
            case JsonValueKind.Array: return e.EnumerateArray().Any(HasScriptUrl);
            case JsonValueKind.Object: return e.EnumerateObject().Any(p => HasScriptUrl(p.Value));
            default: return false;
        }
    }
}

internal static class StoreAccess
{
    public static Task<Store?> TrackedAsync(EcommerceDbContext db, CancellationToken ct) => db.Stores.FirstOrDefaultAsync(ct);
}

// ═════════════════════════════════════════════════════════════════════════════
// Settings
// ═════════════════════════════════════════════════════════════════════════════

internal sealed class GetStoreHandler(EcommerceDbContext db, ShopLinks links) : IQueryHandler<GetStoreQuery, StoreSettingsDto>
{
    public async Task<Result<StoreSettingsDto>> Handle(GetStoreQuery q, CancellationToken ct)
    {
        var s = await db.Stores.AsNoTracking().FirstOrDefaultAsync(ct);
        return s is null ? Result.Failure<StoreSettingsDto>(StoreErrors.NoStore) : Result.Success(StoreMapping.ToDto(s, links));
    }
}

internal sealed class CreateStoreHandler(EcommerceDbContext db, ShopLinks links) : ICommandHandler<CreateStoreCommand, StoreSettingsDto>
{
    public async Task<Result<StoreSettingsDto>> Handle(CreateStoreCommand cmd, CancellationToken ct)
    {
        if (await db.Stores.AnyAsync(ct)) return Result.Failure<StoreSettingsDto>(StoreErrors.Duplicate("This workspace already has a store."));

        var slug = cmd.Slug.Trim().ToLowerInvariant();
        if (ReservedSlugs.IsReserved(slug)) return Result.Failure<StoreSettingsDto>(StoreErrors.Duplicate("That address is reserved. Please choose another."));
        if (await db.Stores.IgnoreQueryFilters().AnyAsync(s => s.Slug == slug, ct))
            return Result.Failure<StoreSettingsDto>(StoreErrors.Duplicate("That address is already taken. Please choose another."));

        var store = new Store(cmd.Name, slug, string.IsNullOrWhiteSpace(TenantAmbient.Currency) ? "USD" : TenantAmbient.Currency!.ToUpperInvariant());
        StoreSeed.Apply(db, store);
        db.Stores.Add(store);
        await db.SaveChangesAsync(ct);
        return Result.Success(StoreMapping.ToDto(store, links));
    }
}

internal sealed class UpdateStoreHandler(EcommerceDbContext db, ISecretProtector protector, ShopLinks links)
    : ICommandHandler<UpdateStoreCommand, StoreSettingsDto>
{
    public async Task<Result<StoreSettingsDto>> Handle(UpdateStoreCommand c, CancellationToken ct)
    {
        var s = await StoreAccess.TrackedAsync(db, ct);
        if (s is null) return Result.Failure<StoreSettingsDto>(StoreErrors.NoStore);

        var slug = c.Slug.Trim().ToLowerInvariant();
        if (slug != s.Slug)
        {
            if (ReservedSlugs.IsReserved(slug)) return Result.Failure<StoreSettingsDto>(StoreErrors.Duplicate("That address is reserved. Please choose another."));
            if (await db.Stores.IgnoreQueryFilters().AnyAsync(x => x.Slug == slug && x.Id != s.Id, ct))
                return Result.Failure<StoreSettingsDto>(StoreErrors.Duplicate("That address is already taken. Please choose another."));
        }

        var domain = StoreMapping.NormaliseDomain(c.CustomDomain);
        if (domain is not null)
        {
            if (!StoreMapping.IsValidDomain(domain)) return Result.Failure<StoreSettingsDto>(StoreErrors.Invalid("That does not look like a domain name (for example shop.example.com)."));
            var platform = links.BaseDomains().ToList();
            if (platform.Any(b => domain == b || domain.EndsWith("." + b)))
                return Result.Failure<StoreSettingsDto>(StoreErrors.Invalid("That domain belongs to the platform. Use the address field for it."));
            if (await db.Stores.IgnoreQueryFilters().AnyAsync(x => x.CustomDomain == domain && x.Id != s.Id, ct))
                return Result.Failure<StoreSettingsDto>(StoreErrors.Duplicate("That domain is already used by another store."));
        }

        if (!ShopJson.IsJson(c.ThemeJson, JsonValueKind.Object) || !ShopJson.IsJson(c.SocialJson, JsonValueKind.Object)
            || !ShopJson.IsJson(c.HeaderMenuJson, JsonValueKind.Array) || !ShopJson.IsJson(c.FooterMenuJson, JsonValueKind.Array))
            return Result.Failure<StoreSettingsDto>(StoreErrors.Invalid("Theme, menus or social links are not in the expected format."));
        foreach (var json in new[] { c.HeaderMenuJson, c.FooterMenuJson, c.SocialJson })
        {
            using var doc = JsonDocument.Parse(json);
            if (StoreMapping.HasScriptUrl(doc.RootElement)) return Result.Failure<StoreSettingsDto>(StoreErrors.Invalid("A link in your menus or social links is not allowed."));
        }

        // A payment method you switch on must be usable, or shoppers reach a checkout that cannot take their money.
        var stripeKey = c.StripeSecretKey is null ? null : c.StripeSecretKey.Trim();
        var hasStripe = stripeKey is null ? !string.IsNullOrEmpty(s.StripeSecretEnc) : stripeKey.Length > 0;
        if (c.StripeEnabled && !hasStripe) return Result.Failure<StoreSettingsDto>(StoreErrors.Invalid("Enter your Stripe secret key to turn on card payments."));
        if (stripeKey is { Length: > 0 } && !(stripeKey.StartsWith("sk_") || stripeKey.StartsWith("rk_")))
            return Result.Failure<StoreSettingsDto>(StoreErrors.Invalid("That does not look like a Stripe secret key (it starts with sk_ or rk_)."));

        var paypalSecret = c.PayPalSecret is null ? null : c.PayPalSecret.Trim();
        var hasPayPalSecret = paypalSecret is null ? !string.IsNullOrEmpty(s.PayPalSecretEnc) : paypalSecret.Length > 0;
        var paypalClient = string.IsNullOrWhiteSpace(c.PayPalClientId) ? null : c.PayPalClientId.Trim();
        if (c.PayPalEnabled && (paypalClient is null || !hasPayPalSecret))
            return Result.Failure<StoreSettingsDto>(StoreErrors.Invalid("Enter your PayPal client ID and secret to turn on PayPal."));
        if (c.BankEnabled && string.IsNullOrWhiteSpace(c.BankDetails))
            return Result.Failure<StoreSettingsDto>(StoreErrors.Invalid("Enter your bank details so customers know where to pay."));

        if (c.IsPublished && !(c.CodEnabled || c.BankEnabled || c.StripeEnabled || c.PayPalEnabled))
            return Result.Failure<StoreSettingsDto>(StoreErrors.Invalid("Turn on at least one payment method before opening the store."));
        if (c.IsPublished && !await db.ShippingZones.AnyAsync(z => z.IsActive && !z.IsDeleted, ct))
            return Result.Failure<StoreSettingsDto>(StoreErrors.Invalid("Add a delivery zone before opening the store."));

        s.Name = c.Name.Trim(); s.Slug = slug; s.CustomDomain = domain; s.IsPublished = c.IsPublished;
        s.CurrencyCode = c.CurrencyCode.Trim().ToUpperInvariant(); s.Language = c.Language;
        s.ContactEmail = Clean(c.ContactEmail); s.ContactPhone = Clean(c.ContactPhone); s.Address = Clean(c.Address); s.OrderNotifyEmail = Clean(c.OrderNotifyEmail);
        s.LogoAssetId = c.LogoAssetId; s.FaviconAssetId = c.FaviconAssetId;
        s.AnnouncementText = Clean(c.AnnouncementText); s.SeoTitle = Clean(c.SeoTitle); s.MetaDescription = Clean(c.MetaDescription);
        s.ThemeJson = c.ThemeJson; s.HeaderMenuJson = c.HeaderMenuJson; s.FooterMenuJson = c.FooterMenuJson; s.SocialJson = c.SocialJson;
        s.TaxPercent = c.TaxPercent; s.PricesIncludeTax = c.PricesIncludeTax; s.AllowGuestCheckout = c.AllowGuestCheckout; s.RequirePhone = c.RequirePhone;
        s.CodEnabled = c.CodEnabled; s.CodInstructions = Clean(c.CodInstructions);
        s.BankEnabled = c.BankEnabled; s.BankDetails = Clean(c.BankDetails);
        s.StripeEnabled = c.StripeEnabled;
        if (stripeKey is not null) s.StripeSecretEnc = stripeKey.Length == 0 ? null : protector.Protect(stripeKey);
        if (c.StripeWebhookSecret is not null) s.StripeWebhookSecretEnc = c.StripeWebhookSecret.Trim().Length == 0 ? null : protector.Protect(c.StripeWebhookSecret.Trim());
        s.PayPalEnabled = c.PayPalEnabled; s.PayPalClientId = paypalClient; s.PayPalSandbox = c.PayPalSandbox;
        if (paypalSecret is not null) s.PayPalSecretEnc = paypalSecret.Length == 0 ? null : protector.Protect(paypalSecret);
        s.Touch();

        await db.SaveChangesAsync(ct);
        return Result.Success(StoreMapping.ToDto(s, links));
    }

    private static string? Clean(string? v) => string.IsNullOrWhiteSpace(v) ? null : v.Trim();
}

// ═════════════════════════════════════════════════════════════════════════════
// Pages (page builder)
// ═════════════════════════════════════════════════════════════════════════════

internal static class PageRules
{
    public static readonly HashSet<string> SectionTypes =
    [
        "hero", "featured_products", "collection_list", "rich_text", "image_text", "banner", "features", "testimonials",
        "faq", "gallery", "video", "contact_info", "spacer",
    ];

    /// <summary>The builder's output is data, but it is data a shopper's browser acts on — so its shape is checked, not trusted.</summary>
    public static Error? Validate(string sectionsJson)
    {
        JsonDocument doc;
        try { doc = JsonDocument.Parse(sectionsJson); } catch (JsonException) { return StoreErrors.Invalid("The page content is not valid."); }
        using (doc)
        {
            if (doc.RootElement.ValueKind != JsonValueKind.Array) return StoreErrors.Invalid("The page content is not valid.");
            if (doc.RootElement.GetArrayLength() > 60) return StoreErrors.Invalid("A page can hold at most 60 sections.");
            foreach (var sec in doc.RootElement.EnumerateArray())
            {
                if (sec.ValueKind != JsonValueKind.Object || !sec.TryGetProperty("type", out var t) || t.ValueKind != JsonValueKind.String
                    || !SectionTypes.Contains(t.GetString() ?? ""))
                    return StoreErrors.Invalid("A section on the page has an unknown type.");
            }
            if (StoreMapping.HasScriptUrl(doc.RootElement)) return StoreErrors.Invalid("A link on the page is not allowed.");
        }
        return null;
    }

    public static PageDto ToDto(StorePage p) => new(p.Id, p.Slug, p.Title, p.Kind, p.IsPublished, p.SectionsJson, p.SeoTitle, p.MetaDescription);
}

internal sealed class GetPagesHandler(EcommerceDbContext db) : IQueryHandler<GetPagesQuery, IReadOnlyList<PageSummaryDto>>
{
    public async Task<Result<IReadOnlyList<PageSummaryDto>>> Handle(GetPagesQuery q, CancellationToken ct)
    {
        var rows = await db.Pages.AsNoTracking().Where(p => !p.IsDeleted)
            .OrderBy(p => p.Kind == "home" ? 0 : p.Kind == "page" ? 1 : 2).ThenBy(p => p.Title).ToListAsync(ct);
        IReadOnlyList<PageSummaryDto> list = rows.Select(p =>
        {
            var n = 0;
            try { using var d = JsonDocument.Parse(p.SectionsJson); n = d.RootElement.GetArrayLength(); } catch { /* count stays 0 */ }
            return new PageSummaryDto(p.Id, p.Slug, p.Title, p.Kind, p.IsPublished, n, p.UpdatedAt ?? p.CreatedAt);
        }).ToList();
        return Result.Success(list);
    }
}

internal sealed class GetPageHandler(EcommerceDbContext db) : IQueryHandler<GetPageQuery, PageDto>
{
    public async Task<Result<PageDto>> Handle(GetPageQuery q, CancellationToken ct)
    {
        var p = await db.Pages.AsNoTracking().FirstOrDefaultAsync(x => x.Id == q.Id && !x.IsDeleted, ct);
        return p is null ? Result.Failure<PageDto>(StoreErrors.NotFound("Page")) : Result.Success(PageRules.ToDto(p));
    }
}

internal sealed class SavePageHandler(EcommerceDbContext db) : ICommandHandler<SavePageCommand, PageDto>
{
    public async Task<Result<PageDto>> Handle(SavePageCommand c, CancellationToken ct)
    {
        var problem = PageRules.Validate(c.SectionsJson);
        if (problem is not null) return Result.Failure<PageDto>(problem);

        var slug = c.Slug.Trim().ToLowerInvariant();
        // The front page is the one called "home"; nothing else may take that address and it cannot be renamed.
        if ((c.Kind == "home") != (slug == "home")) return Result.Failure<PageDto>(StoreErrors.Invalid("The front page's address is always \"home\"."));

        StorePage? page = null;
        if (c.Id is Guid id)
        {
            page = await db.Pages.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, ct);
            if (page is null) return Result.Failure<PageDto>(StoreErrors.NotFound("Page"));
            if (page.Kind == "home" && c.Kind != "home") return Result.Failure<PageDto>(StoreErrors.Invalid("The front page cannot be changed into another kind of page."));
        }
        if (await db.Pages.AnyAsync(x => x.Slug == slug && !x.IsDeleted && (page == null || x.Id != page.Id), ct))
            return Result.Failure<PageDto>(StoreErrors.Duplicate("Another page already uses that address."));

        if (page is null) { page = new StorePage(slug, c.Title, c.Kind); db.Pages.Add(page); }
        page.Slug = slug; page.Title = c.Title.Trim(); page.Kind = c.Kind;
        // The front page is always visible: a store without one would show nothing.
        page.IsPublished = c.Kind == "home" || c.IsPublished;
        page.SectionsJson = c.SectionsJson;
        page.SeoTitle = string.IsNullOrWhiteSpace(c.SeoTitle) ? null : c.SeoTitle.Trim();
        page.MetaDescription = string.IsNullOrWhiteSpace(c.MetaDescription) ? null : c.MetaDescription.Trim();
        page.Touch();
        await db.SaveChangesAsync(ct);
        return Result.Success(PageRules.ToDto(page));
    }
}

internal sealed class DeletePageHandler(EcommerceDbContext db) : ICommandHandler<DeletePageCommand>
{
    public async Task<Result> Handle(DeletePageCommand c, CancellationToken ct)
    {
        var p = await db.Pages.FirstOrDefaultAsync(x => x.Id == c.Id && !x.IsDeleted, ct);
        if (p is null) return Result.Failure(StoreErrors.NotFound("Page"));
        if (p.Kind == "home") return Result.Failure(StoreErrors.Invalid("The front page cannot be deleted."));
        p.IsDeleted = true; p.Touch();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// Assets
// ═════════════════════════════════════════════════════════════════════════════

internal static class AssetRules
{
    public const int MaxBytes = 3 * 1024 * 1024;

    /// <summary>Raster images only, identified by their first bytes rather than by what the upload claims. SVG is refused: opened directly it can run script on our origin.</summary>
    public static string? SniffType(byte[] d)
    {
        if (d.Length >= 8 && d[0] == 0x89 && d[1] == 0x50 && d[2] == 0x4E && d[3] == 0x47) return "image/png";
        if (d.Length >= 3 && d[0] == 0xFF && d[1] == 0xD8 && d[2] == 0xFF) return "image/jpeg";
        if (d.Length >= 12 && d[0] == 'R' && d[1] == 'I' && d[2] == 'F' && d[3] == 'F' && d[8] == 'W' && d[9] == 'E' && d[10] == 'B' && d[11] == 'P') return "image/webp";
        if (d.Length >= 6 && d[0] == 'G' && d[1] == 'I' && d[2] == 'F' && d[3] == '8') return "image/gif";
        return null;
    }
}

internal sealed class UploadAssetHandler(EcommerceDbContext db) : ICommandHandler<UploadAssetCommand, AssetDto>
{
    public async Task<Result<AssetDto>> Handle(UploadAssetCommand c, CancellationToken ct)
    {
        if (c.Data.Length == 0) return Result.Failure<AssetDto>(StoreErrors.Invalid("That file is empty."));
        if (c.Data.Length > AssetRules.MaxBytes) return Result.Failure<AssetDto>(StoreErrors.Invalid("Images can be up to 3 MB."));
        var type = AssetRules.SniffType(c.Data);
        if (type is null) return Result.Failure<AssetDto>(StoreErrors.Invalid("Please upload a PNG, JPEG, WebP or GIF image."));

        var name = Path.GetFileName(string.IsNullOrWhiteSpace(c.FileName) ? "image" : c.FileName.Trim());
        var asset = new StoreAsset(name.Length > 200 ? name[..200] : name, type, c.Data);
        db.Assets.Add(asset);
        await db.SaveChangesAsync(ct);
        return Result.Success(new AssetDto(asset.Id, asset.FileName, asset.ContentType, asset.Size));
    }
}

internal sealed class GetAssetsHandler(EcommerceDbContext db) : IQueryHandler<GetAssetsQuery, IReadOnlyList<AssetDto>>
{
    public async Task<Result<IReadOnlyList<AssetDto>>> Handle(GetAssetsQuery q, CancellationToken ct)
    {
        IReadOnlyList<AssetDto> list = await db.Assets.AsNoTracking().Where(a => !a.IsDeleted)
            .OrderByDescending(a => a.CreatedAt).Take(200).Select(a => new AssetDto(a.Id, a.FileName, a.ContentType, a.Size)).ToListAsync(ct);
        return Result.Success(list);
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// Collections
// ═════════════════════════════════════════════════════════════════════════════

internal static class CollectionMapping
{
    public static CollectionDto ToDto(StoreCollection c) => new(
        c.Id, c.Slug, c.Name, c.Description, c.ImageAssetId, ShopJson.Guids(c.TemplateIdsJson), c.CategoryName, c.IsPublished, c.SortOrder);
}

internal sealed class GetCollectionsHandler(EcommerceDbContext db) : IQueryHandler<GetCollectionsQuery, IReadOnlyList<CollectionDto>>
{
    public async Task<Result<IReadOnlyList<CollectionDto>>> Handle(GetCollectionsQuery q, CancellationToken ct)
    {
        var rows = await db.Collections.AsNoTracking().Where(c => !c.IsDeleted).OrderBy(c => c.SortOrder).ThenBy(c => c.Name).ToListAsync(ct);
        IReadOnlyList<CollectionDto> list = rows.Select(CollectionMapping.ToDto).ToList();
        return Result.Success(list);
    }
}

internal sealed class SaveCollectionHandler(EcommerceDbContext db) : ICommandHandler<SaveCollectionCommand, CollectionDto>
{
    public async Task<Result<CollectionDto>> Handle(SaveCollectionCommand c, CancellationToken ct)
    {
        var slug = c.Slug.Trim().ToLowerInvariant();
        StoreCollection? col = null;
        if (c.Id is Guid id)
        {
            col = await db.Collections.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, ct);
            if (col is null) return Result.Failure<CollectionDto>(StoreErrors.NotFound("Collection"));
        }
        if (await db.Collections.AnyAsync(x => x.Slug == slug && !x.IsDeleted && (col == null || x.Id != col.Id), ct))
            return Result.Failure<CollectionDto>(StoreErrors.Duplicate("Another collection already uses that address."));

        if (col is null) { col = new StoreCollection(slug, c.Name); db.Collections.Add(col); }
        col.Slug = slug; col.Name = c.Name.Trim();
        col.Description = string.IsNullOrWhiteSpace(c.Description) ? null : c.Description.Trim();
        col.ImageAssetId = c.ImageAssetId;
        col.CategoryName = string.IsNullOrWhiteSpace(c.CategoryName) ? null : c.CategoryName.Trim();
        col.TemplateIdsJson = ShopJson.Write(c.TemplateIds.Distinct().ToList());
        col.IsPublished = c.IsPublished; col.SortOrder = c.SortOrder;
        col.Touch();
        await db.SaveChangesAsync(ct);
        return Result.Success(CollectionMapping.ToDto(col));
    }
}

internal sealed class DeleteCollectionHandler(EcommerceDbContext db) : ICommandHandler<DeleteCollectionCommand>
{
    public async Task<Result> Handle(DeleteCollectionCommand c, CancellationToken ct)
    {
        var col = await db.Collections.FirstOrDefaultAsync(x => x.Id == c.Id && !x.IsDeleted, ct);
        if (col is null) return Result.Failure(StoreErrors.NotFound("Collection"));
        col.IsDeleted = true; col.Touch();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// Shipping
// ═════════════════════════════════════════════════════════════════════════════

internal static class ZoneMapping
{
    public static ShippingZoneDto ToDto(ShippingZone z) => new(
        z.Id, z.Name, ShopJson.Strings(z.CountriesJson), z.FlatRate, z.FreeOver, z.MinOrder, z.EstimatedDays, z.IsActive, z.SortOrder);
}

internal sealed class GetShippingZonesHandler(EcommerceDbContext db) : IQueryHandler<GetShippingZonesQuery, IReadOnlyList<ShippingZoneDto>>
{
    public async Task<Result<IReadOnlyList<ShippingZoneDto>>> Handle(GetShippingZonesQuery q, CancellationToken ct)
    {
        var rows = await db.ShippingZones.AsNoTracking().Where(z => !z.IsDeleted).OrderBy(z => z.SortOrder).ThenBy(z => z.Name).ToListAsync(ct);
        IReadOnlyList<ShippingZoneDto> list = rows.Select(ZoneMapping.ToDto).ToList();
        return Result.Success(list);
    }
}

internal sealed class SaveShippingZoneHandler(EcommerceDbContext db) : ICommandHandler<SaveShippingZoneCommand, ShippingZoneDto>
{
    public async Task<Result<ShippingZoneDto>> Handle(SaveShippingZoneCommand c, CancellationToken ct)
    {
        var countries = c.Countries.Select(x => x.Trim().ToUpperInvariant()).Where(x => x.Length > 0).Distinct().ToList();
        if (countries.Any(x => x != "*" && x.Length != 2)) return Result.Failure<ShippingZoneDto>(StoreErrors.Invalid("Countries must be two-letter codes, or * for everywhere."));
        if (countries.Contains("*")) countries = ["*"];

        ShippingZone? z = null;
        if (c.Id is Guid id)
        {
            z = await db.ShippingZones.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, ct);
            if (z is null) return Result.Failure<ShippingZoneDto>(StoreErrors.NotFound("Zone"));
        }
        if (z is null) { z = new ShippingZone(c.Name); db.ShippingZones.Add(z); }
        z.Name = c.Name.Trim(); z.CountriesJson = ShopJson.Write(countries); z.FlatRate = c.FlatRate; z.FreeOver = c.FreeOver; z.MinOrder = c.MinOrder;
        z.EstimatedDays = string.IsNullOrWhiteSpace(c.EstimatedDays) ? null : c.EstimatedDays.Trim(); z.IsActive = c.IsActive; z.SortOrder = c.SortOrder;
        await db.SaveChangesAsync(ct);
        return Result.Success(ZoneMapping.ToDto(z));
    }
}

internal sealed class DeleteShippingZoneHandler(EcommerceDbContext db) : ICommandHandler<DeleteShippingZoneCommand>
{
    public async Task<Result> Handle(DeleteShippingZoneCommand c, CancellationToken ct)
    {
        var z = await db.ShippingZones.FirstOrDefaultAsync(x => x.Id == c.Id && !x.IsDeleted, ct);
        if (z is null) return Result.Failure(StoreErrors.NotFound("Zone"));
        z.IsDeleted = true;
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// Discounts
// ═════════════════════════════════════════════════════════════════════════════

internal static class DiscountMapping
{
    public static DiscountDto ToDto(DiscountCode d) => new(d.Id, d.Code, d.Kind, d.Value, d.MinSubtotal, d.MaxUses, d.UsedCount, d.StartsAt, d.EndsAt, d.IsActive);
}

internal sealed class GetDiscountsHandler(EcommerceDbContext db) : IQueryHandler<GetDiscountsQuery, IReadOnlyList<DiscountDto>>
{
    public async Task<Result<IReadOnlyList<DiscountDto>>> Handle(GetDiscountsQuery q, CancellationToken ct)
    {
        var rows = await db.DiscountCodes.AsNoTracking().Where(d => !d.IsDeleted).OrderByDescending(d => d.CreatedAt).ToListAsync(ct);
        IReadOnlyList<DiscountDto> list = rows.Select(DiscountMapping.ToDto).ToList();
        return Result.Success(list);
    }
}

internal sealed class SaveDiscountHandler(EcommerceDbContext db) : ICommandHandler<SaveDiscountCommand, DiscountDto>
{
    public async Task<Result<DiscountDto>> Handle(SaveDiscountCommand c, CancellationToken ct)
    {
        var code = c.Code.Trim().ToUpperInvariant();
        if (c.StartsAt is DateTime s && c.EndsAt is DateTime e && e <= s) return Result.Failure<DiscountDto>(StoreErrors.Invalid("The end date must be after the start date."));

        DiscountCode? d = null;
        if (c.Id is Guid id)
        {
            d = await db.DiscountCodes.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, ct);
            if (d is null) return Result.Failure<DiscountDto>(StoreErrors.NotFound("Discount"));
        }
        if (await db.DiscountCodes.AnyAsync(x => x.Code == code && !x.IsDeleted && (d == null || x.Id != d.Id), ct))
            return Result.Failure<DiscountDto>(StoreErrors.Duplicate("That code already exists."));

        if (d is null) { d = new DiscountCode(code, c.Kind, c.Value); db.DiscountCodes.Add(d); }
        d.Code = code; d.Kind = c.Kind; d.Value = c.Kind == DiscountKinds.FreeShipping ? 0 : c.Value;
        d.MinSubtotal = c.MinSubtotal; d.MaxUses = c.MaxUses; d.StartsAt = c.StartsAt; d.EndsAt = c.EndsAt; d.IsActive = c.IsActive;
        await db.SaveChangesAsync(ct);
        return Result.Success(DiscountMapping.ToDto(d));
    }
}

internal sealed class DeleteDiscountHandler(EcommerceDbContext db) : ICommandHandler<DeleteDiscountCommand>
{
    public async Task<Result> Handle(DeleteDiscountCommand c, CancellationToken ct)
    {
        var d = await db.DiscountCodes.FirstOrDefaultAsync(x => x.Id == c.Id && !x.IsDeleted, ct);
        if (d is null) return Result.Failure(StoreErrors.NotFound("Discount"));
        d.IsDeleted = true; d.IsActive = false;
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// Starter content
// ═════════════════════════════════════════════════════════════════════════════

/// <summary>
/// What a brand-new store starts with, so the owner edits a working store rather than facing a blank one: a front page,
/// the pages shoppers expect (delivery, returns, privacy, terms, about, contact), menus, a theme, and one delivery zone
/// covering everywhere. Nothing here is published until the owner opens the store.
/// </summary>
internal static class StoreSeed
{
    public static void Apply(EcommerceDbContext db, Store store)
    {
        store.ThemeJson = ShopJson.Write(new Dictionary<string, object>
        {
            ["preset"] = "classic", ["primary"] = "#111827", ["accent"] = "#2563eb", ["background"] = "#ffffff", ["surface"] = "#f9fafb",
            ["text"] = "#111827", ["muted"] = "#6b7280", ["headingFont"] = "inter", ["bodyFont"] = "inter", ["radius"] = "md",
            ["cardStyle"] = "plain", ["productColumns"] = 4, ["headerStyle"] = "left",
        });
        store.HeaderMenuJson = ShopJson.Write(new[]
        {
            new { label = "Shop", url = "/products" }, new { label = "About", url = "/pages/about" }, new { label = "Contact", url = "/pages/contact" },
        });
        store.FooterMenuJson = ShopJson.Write(new[]
        {
            new { label = "Delivery", url = "/pages/delivery" }, new { label = "Returns", url = "/pages/returns" },
            new { label = "Privacy", url = "/pages/privacy" }, new { label = "Terms", url = "/pages/terms" },
        });

        db.Pages.Add(Page("home", "Home", "home", ShopJson.Write(new object[]
        {
            Section("hero", new { heading = store.Name, subheading = "Welcome to our online store.", buttonLabel = "Shop now", buttonUrl = "/products", align = "center", height = "md", overlay = 40 }),
            Section("features", new { heading = "", items = new object[]
            {
                new { icon = "truck", title = "Fast delivery", text = "We ship quickly to your door." },
                new { icon = "shield", title = "Secure checkout", text = "Your payment details stay safe." },
                new { icon = "refresh", title = "Easy returns", text = "Changed your mind? Let us know." },
            } }),
            Section("featured_products", new { heading = "Our products", source = "all", limit = 8, sort = "newest" }),
        })));
        db.Pages.Add(Page("about", "About us", "page", Text("About us", "Tell your customers who you are, what you sell and why it matters.\n\nEdit this page in the page builder.")));
        db.Pages.Add(Page("contact", "Contact", "page", ShopJson.Write(new object[] { Section("contact_info", new { heading = "Get in touch" }) })));
        db.Pages.Add(Page("delivery", "Delivery", "policy", Text("Delivery", "Describe where you deliver, how long it takes and what it costs.")));
        db.Pages.Add(Page("returns", "Returns & refunds", "policy", Text("Returns & refunds", "Explain how customers can return an item and when they get their money back.")));
        db.Pages.Add(Page("privacy", "Privacy policy", "policy", Text("Privacy policy", "Explain what information you collect from customers and how you use it.")));
        db.Pages.Add(Page("terms", "Terms of service", "policy", Text("Terms of service", "Set out the terms customers agree to when they buy from you.")));

        var zone = new ShippingZone("Everywhere") { FlatRate = 0, EstimatedDays = "3-7 days" };
        db.ShippingZones.Add(zone);
    }

    private static StorePage Page(string slug, string title, string kind, string sections) => new(slug, title, kind) { SectionsJson = sections };
    private static object Section(string type, object settings) => new { id = Guid.NewGuid().ToString("N")[..10], type, settings };
    private static string Text(string heading, string body) => ShopJson.Write(new object[] { Section("rich_text", new { heading, body, align = "start" }) });
}
