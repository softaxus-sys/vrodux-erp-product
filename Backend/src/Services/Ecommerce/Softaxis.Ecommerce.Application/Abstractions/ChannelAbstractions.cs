using Softaxis.BuildingBlocks.Domain.Results;

namespace Softaxis.Ecommerce.Application.Abstractions;

// ── What a channel provider (Shopify today) is asked to do, in terms that do not mention any one store ──

public sealed record ChannelCredentials(string ShopDomain, string Token);

public sealed record ShopInfo(string Name, string Domain, string? CurrencyCode, string? PlanName);

public sealed record ChannelLocation(string Id, string Name, bool Active);

public sealed record ProductPushImage(byte[] Data, string FileName, string? Alt);

public sealed record ProductPushVariant(
    Guid ProductId, string? Sku, string? Barcode, decimal Price,
    IReadOnlyList<string> OptionValues, bool TrackInventory, decimal? WeightGrams,
    string? ExternalVariantId);

/// <param name="Images">Null = leave the store's photos as they are; a list (even empty) replaces them.</param>
public sealed record ProductPush(
    string Title, string? BodyHtml, string? Vendor, string? ProductType, string? Tags, string Handle,
    bool Active, string? SeoTitle, string? MetaDescription,
    IReadOnlyList<string> OptionNames,
    IReadOnlyList<ProductPushVariant> Variants,
    IReadOnlyList<ProductPushImage>? Images);

/// <param name="ProductId">The Inventory product the store variant was matched to.</param>
public sealed record PushedVariant(Guid ProductId, string ExternalVariantId, string? ExternalInventoryItemId, string? Sku);

public sealed record PushedProduct(string ExternalProductId, string? Handle, IReadOnlyList<PushedVariant> Variants);

public sealed record ExternalOrderLine(string? ExternalVariantId, string? Sku, string Title, decimal Quantity, decimal UnitPrice);

public sealed record ExternalOrder(
    string ExternalId, string Number, string? Email, string? CustomerName,
    DateTime PlacedAt, DateTime UpdatedAt, DateTime? CancelledAt,
    string? FinancialStatus, string? FulfillmentStatus,
    decimal Total, string? CurrencyCode,
    IReadOnlyList<ExternalOrderLine> Lines);

public enum ChannelFailure
{
    /// <summary>The store is busy, unreachable or erroring. Retrying later is the right response.</summary>
    Transient,
    /// <summary>Credentials refused or a permission missing. Retrying cannot help until a person acts.</summary>
    Permanent,
    /// <summary>The store accepted the connection but refused this one item (for example a product it considers invalid).</summary>
    ItemRejected,
}

/// <summary>A failure talking to a store, classified by what should happen next.</summary>
public sealed class ChannelException(string message, ChannelFailure failure = ChannelFailure.Transient) : Exception(message)
{
    public ChannelFailure Failure { get; } = failure;
    public bool Permanent => Failure == ChannelFailure.Permanent;
}

/// <summary>One kind of store. Implementations talk to the store's own API and know nothing about Inventory.</summary>
public interface IChannelProvider
{
    string Kind { get; }

    Task<ShopInfo> VerifyAsync(ChannelCredentials c, CancellationToken ct);
    Task<IReadOnlyList<ChannelLocation>> GetLocationsAsync(ChannelCredentials c, CancellationToken ct);

    /// <summary>Creates the product, or updates it when <paramref name="externalProductId"/> is given.</summary>
    Task<PushedProduct> UpsertProductAsync(ChannelCredentials c, ProductPush product, string? externalProductId, CancellationToken ct);

    Task SetProductActiveAsync(ChannelCredentials c, string externalProductId, bool active, CancellationToken ct);
    Task DeleteProductAsync(ChannelCredentials c, string externalProductId, CancellationToken ct);

    /// <summary>Sets the stock level of one variant at one location. Used for the first push and for a deliberate reset.</summary>
    Task SetInventoryAsync(ChannelCredentials c, string locationId, string inventoryItemId, int available, CancellationToken ct);

    /// <summary>
    /// Changes the stock level by a signed amount. Unlike a set, an order the store took a moment ago is not undone by it,
    /// so this is how ordinary changes are sent.
    /// </summary>
    Task AdjustInventoryAsync(ChannelCredentials c, string locationId, string inventoryItemId, int delta, CancellationToken ct);

    /// <summary>Orders created or changed since <paramref name="updatedSince"/> (all recent orders when null).</summary>
    Task<IReadOnlyList<ExternalOrder>> FetchOrdersAsync(ChannelCredentials c, DateTime? updatedSince, CancellationToken ct);
}

public sealed record ProviderInfo(string Kind, string Name, string Description, bool Available, string Requirements);

public interface IChannelProviders
{
    IChannelProvider? Find(string kind);
    IReadOnlyList<ProviderInfo> All { get; }
}

/// <summary>Encrypts a store credential for storage. The ciphertext is useless without this server's key ring.</summary>
public interface ISecretProtector
{
    string Protect(string plain);
    string? Unprotect(string protectedValue);
}

// ── Inventory, as the channels see it ──

public sealed record SnapshotVariant(
    Guid ProductId, string Name, string? Sku, string? Barcode,
    IReadOnlyDictionary<string, string> Options,
    decimal SalePrice, decimal StockQuantity, bool TrackInventory, bool IsActive, bool SellOnline, decimal? WeightGrams);

public sealed record SnapshotImage(Guid Id, Guid? ProductId, bool IsPrimary, int SortOrder, string? FileName, string? AltText);

/// <summary>An Inventory listing as it must appear online.</summary>
public sealed record TemplateSnapshot(
    Guid Id, string Name, string? Description, string? ShortDescription,
    string? CategoryName, string? BrandName, string Slug, string? SeoTitle, string? MetaDescription, string? Tags,
    IReadOnlyList<string> OptionNames, bool PublishedOnline, bool IsActive,
    IReadOnlyList<SnapshotVariant> Variants, IReadOnlyList<SnapshotImage> Images);

public sealed record TemplateLookup(Guid Id, string Name, int VariantCount, decimal TotalStock, bool PublishedOnline, bool IsActive);

public sealed record ImageFile(byte[] Data, string ContentType, string FileName);

/// <summary>
/// The only door from Ecommerce into Inventory: it reads listings, photos and stock, and asks for stock
/// movements. It never writes an Inventory table itself.
/// </summary>
public interface IInventoryCatalogue
{
    Task<TemplateSnapshot?> GetTemplateAsync(Guid templateId, CancellationToken ct);
    Task<ImageFile?> GetImageAsync(Guid templateId, Guid imageId, CancellationToken ct);
    Task<IReadOnlyList<TemplateLookup>> SearchTemplatesAsync(string? search, int take, CancellationToken ct);

    /// <summary>Current on-hand quantity of one product (null if it no longer exists).</summary>
    Task<decimal?> GetStockAsync(Guid productId, CancellationToken ct);

    /// <summary>The Inventory product with this SKU, if exactly one exists.</summary>
    Task<Guid?> FindProductBySkuAsync(string sku, CancellationToken ct);

    /// <summary>Takes stock out for a sale made in a store.</summary>
    Task<Result> TakeStockAsync(Guid productId, decimal quantity, string reference, string notes, CancellationToken ct);

    /// <summary>Puts stock back (an order cancelled in the store).</summary>
    Task<Result> ReturnStockAsync(Guid productId, decimal quantity, string reference, string notes, CancellationToken ct);
}
