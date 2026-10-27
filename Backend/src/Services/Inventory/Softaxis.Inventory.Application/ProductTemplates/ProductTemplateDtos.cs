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

/// <summary>Why a listing cannot go live yet. Empty = ready.</summary>
public sealed record PublishCheckDto(bool Ready, IReadOnlyList<string> Problems);
