namespace Softaxis.Inventory.Application.ProductTemplates;

public sealed record ProductOptionDto(string Name, IReadOnlyList<string> Values);

public sealed record ProductImageDto(
    Guid Id, Guid? ProductId, bool IsPrimary, int SortOrder, string? FileName, string? AltText);

/// <summary>One purchasable combination — an ordinary Inventory product.</summary>
public sealed record TemplateVariantDto(
    Guid     ProductId,
    string   Name,
    string?  SKU,
    string?  Barcode,
    IReadOnlyDictionary<string, string> Options,
    decimal  SalePrice,
    decimal  CostPrice,
    decimal  TaxRate,
    decimal  StockQuantity,
    bool     TrackInventory,
    bool     IsActive,
    bool     SellOnline,
    decimal? WeightGrams,
    decimal? LengthCm,
    decimal? WidthCm,
    decimal? HeightCm);

public sealed record ProductTemplateSummaryDto(
    Guid      Id,
    string    Name,
    string    Slug,
    Guid      CategoryId,
    string    CategoryName,
    string?   BrandName,
    bool      PublishedOnline,
    bool      IsActive,
    int       VariantCount,
    decimal   TotalStock,
    decimal?  PriceFrom,
    decimal?  PriceTo,
    Guid?     CoverImageId,
    int       ImageCount,
    DateTime  CreatedAt,
    DateTime? UpdatedAt);

public sealed record ProductTemplateDto(
    Guid      Id,
    string    Name,
    string?   Description,
    string?   ShortDescription,
    Guid      CategoryId,
    string    CategoryName,
    Guid?     BrandId,
    string?   BrandName,
    string    Slug,
    string?   SeoTitle,
    string?   MetaDescription,
    string?   Tags,
    IReadOnlyList<ProductOptionDto> Options,
    bool      PublishedOnline,
    DateTime? PublishedAt,
    bool      IsActive,
    IReadOnlyList<TemplateVariantDto> Variants,
    IReadOnlyList<ProductImageDto>    Images,
    DateTime  CreatedAt,
    DateTime? UpdatedAt);

public sealed record ProductImageFileDto(byte[] Data, string ContentType);

/// <summary>One stock item that could not be listed, and why.</summary>
public sealed record ListOnlineSkipDto(Guid ProductId, string Name, string Reason);

public sealed record ListedProductDto(Guid ProductId, Guid TemplateId, bool Published);

public sealed record ListProductsOnlineResult(
    int Created, int Published, IReadOnlyList<ListedProductDto> Listed, IReadOnlyList<ListOnlineSkipDto> Skipped);

/// <summary>A stock item that is not part of any online listing yet.</summary>
public sealed record UnlistedProductDto(
    Guid Id, string Name, string? SKU, string CategoryName, decimal SalePrice, decimal StockQuantity, bool IsActive);

/// <summary>Where a stock item stands online. Items with no listing are simply absent from the answer.</summary>
public sealed record ProductListingStatusDto(Guid ProductId, Guid TemplateId, bool Published);

/// <summary>Why a listing cannot go live yet. Empty = ready.</summary>
public sealed record PublishCheckDto(bool Ready, IReadOnlyList<string> Problems);
