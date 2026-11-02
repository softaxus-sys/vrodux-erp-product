using MediatR;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Ecommerce.Application.Abstractions;
using Softaxis.Inventory.Application.Abstractions;
using Softaxis.Inventory.Application.ProductTemplates;
using Softaxis.Inventory.Application.StockMovements.Commands.CreateStockMovement;
using Softaxis.Inventory.Domain.Constants;

namespace Softaxis.Ecommerce.Infrastructure.Services;

/// <summary>The store kinds this build can connect. Adding one is a class plus an entry here.</summary>
internal sealed class ChannelProviders(IEnumerable<IChannelProvider> providers) : IChannelProviders
{
    private readonly Dictionary<string, IChannelProvider> _byKind =
        providers.ToDictionary(p => p.Kind, StringComparer.OrdinalIgnoreCase);

    public IChannelProvider? Find(string kind) => _byKind.GetValueOrDefault(kind);

    public IReadOnlyList<ProviderInfo> All { get; } =
    [
        new("shopify", "Shopify",
            "Publish your Inventory listings to a Shopify store, keep stock and prices in step, and bring its orders back.",
            true,
            "A Shopify custom app with an Admin API access token (scopes: products, inventory, locations, orders)."),
        new("woocommerce", "WooCommerce",
            "The same for a WooCommerce site.", false, "Coming soon."),
    ];
}

/// <summary>
/// Encrypts store credentials with ASP.NET Data Protection (the same key ring the CRM integrations use), so a copy of
/// the database alone cannot be used to act as the shop.
/// </summary>
internal sealed class DataProtectionSecretProtector(IDataProtectionProvider provider, ILogger<DataProtectionSecretProtector> log) : ISecretProtector
{
    private readonly IDataProtector _protector = provider.CreateProtector("Softaxis.Ecommerce.ChannelSecrets.v1");

    public string Protect(string plain) => _protector.Protect(plain);

    public string? Unprotect(string protectedValue)
    {
        try { return _protector.Unprotect(protectedValue); }
        catch (Exception ex)
        {
            // A rotated or lost key ring: the credential must be entered again.
            log.LogWarning(ex, "A channel credential could not be decrypted.");
            return null;
        }
    }
}

/// <summary><see cref="IInventoryCatalogue"/> over the Inventory module, by sending its own queries and commands.</summary>
internal sealed class InventoryCatalogue(ISender sender, IProductReadService products) : IInventoryCatalogue
{
    public async Task<TemplateSnapshot?> GetTemplateAsync(Guid templateId, CancellationToken ct)
    {
        var r = await sender.Send(new GetProductTemplateByIdQuery(templateId), ct);
        if (r.IsFailure) return null;
        var t = r.Value;

        return new TemplateSnapshot(
            t.Id, t.Name, t.Description, t.ShortDescription, t.CategoryName, t.BrandName, t.Slug,
            t.SeoTitle, t.MetaDescription, t.Tags,
            t.Options.Select(o => o.Name).ToList(), t.PublishedOnline, t.IsActive,
            t.Variants.Select(v => new SnapshotVariant(
                v.ProductId, v.Name, v.SKU, v.Barcode, v.Options, v.SalePrice, v.StockQuantity,
                v.TrackInventory, v.IsActive, v.SellOnline, v.WeightGrams)).ToList(),
            t.Images.Select(i => new SnapshotImage(i.Id, i.ProductId, i.IsPrimary, i.SortOrder, i.FileName, i.AltText)).ToList());
    }

    public async Task<ImageFile?> GetImageAsync(Guid templateId, Guid imageId, CancellationToken ct)
    {
        var r = await sender.Send(new GetTemplateImageQuery(templateId, imageId), ct);
        if (r.IsFailure) return null;
        var ext = r.Value.ContentType switch { "image/png" => "png", "image/webp" => "webp", "image/gif" => "gif", _ => "jpg" };
        return new ImageFile(r.Value.Data, r.Value.ContentType, $"{imageId:N}.{ext}");
    }

    public async Task<IReadOnlyList<TemplateLookup>> SearchTemplatesAsync(string? search, int take, CancellationToken ct)
    {
        var r = await sender.Send(new GetProductTemplatesQuery(1, take, string.IsNullOrWhiteSpace(search) ? null : search.Trim()), ct);
        if (r.IsFailure) return [];
        return r.Value.Items
            .Select(t => new TemplateLookup(t.Id, t.Name, t.VariantCount, t.TotalStock, t.PublishedOnline, t.IsActive))
            .ToList();
    }

    public async Task<decimal?> GetStockAsync(Guid productId, CancellationToken ct)
        => (await products.GetByIdAsync(productId, ct))?.StockQuantity;

    public async Task<Guid?> FindProductBySkuAsync(string sku, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(sku)) return null;
        var page = await products.GetCombinedPagedAsync(1, 20, sku.Trim(), isActive: null, ct: ct);
        var exact = page.Items.Where(p => string.Equals(p.SKU, sku.Trim(), StringComparison.OrdinalIgnoreCase)).ToList();
        return exact.Count == 1 ? exact[0].Id : null;
    }

    public async Task<Result> TakeStockAsync(Guid productId, decimal quantity, string reference, string notes, CancellationToken ct)
        => await MoveAsync(productId, MovementTypes.Sale, quantity, reference, notes, ct);

    public async Task<Result> ReturnStockAsync(Guid productId, decimal quantity, string reference, string notes, CancellationToken ct)
        => await MoveAsync(productId, MovementTypes.Return, quantity, reference, notes, ct);

    private async Task<Result> MoveAsync(Guid productId, string type, decimal quantity, string reference, string notes, CancellationToken ct)
    {
        var product = await products.GetByIdAsync(productId, ct);
        if (product is null) return Result.Failure(Error.Custom("Product.NotFound", "The Inventory product no longer exists."));

        var result = await sender.Send(new CreateStockMovementCommand(
            productId, type, quantity, product.CostPrice, reference, notes, WarehouseId: null), ct);
        return result.IsSuccess ? Result.Success() : Result.Failure(result.Error);
    }
}
