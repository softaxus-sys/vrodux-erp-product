using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.Inventory.Application.ProductTemplates;

namespace Softaxis.Inventory.Application.Storefront;

// What an online store (the workspace's own storefront) may read of Inventory. Deliberately a small, public-safe
// shape: no cost price, no supplier, no stock beyond what a shopper is told. Everything here is a published listing
// with at least one variant that is active and switched on for online sale.

public sealed record StorefrontCardDto(
    Guid Id, string Name, string Slug, string? ShortDescription, string CategoryName, string? BrandName,
    decimal PriceFrom, decimal PriceTo, Guid? CoverImageId, bool InStock, DateTime? PublishedAt);

public sealed record StorefrontVariantDto(
    Guid ProductId, string Name, string? Sku, IReadOnlyDictionary<string, string> Options,
    decimal Price, decimal TaxRate, decimal Stock, bool TrackInventory);

public sealed record StorefrontImageDto(Guid Id, Guid? ProductId, string? Alt);

public sealed record StorefrontProductDto(
    Guid Id, string Name, string Slug, string? Description, string? ShortDescription,
    string CategoryName, string? BrandName, string? SeoTitle, string? MetaDescription, string? Tags,
    IReadOnlyList<ProductOptionDto> Options, IReadOnlyList<StorefrontVariantDto> Variants,
    IReadOnlyList<StorefrontImageDto> Images);

/// <summary>One variant as checkout sees it. <c>Available</c> is false when the listing was unpublished or the variant switched off since the cart was filled.</summary>
public sealed record StorefrontCheckoutVariantDto(
    Guid ProductId, Guid TemplateId, string TemplateName, string TemplateSlug, string VariantName, string? Sku,
    decimal Price, decimal TaxRate, decimal Stock, bool TrackInventory, bool Available, Guid? CoverImageId,
    decimal? WeightGrams);

public sealed record StorefrontCategoryDto(string Name, int Count);

/// <param name="Sort">newest | name | price_asc | price_desc</param>
public sealed record GetStorefrontProductsQuery(
    string? Search = null, string? CategoryName = null, IReadOnlyList<Guid>? TemplateIds = null,
    string Sort = "newest", int Page = 1, int PageSize = 24) : IQuery<PagedResult<StorefrontCardDto>>;

public sealed record GetStorefrontProductQuery(string Slug) : IQuery<StorefrontProductDto>;

public sealed record GetStorefrontCategoriesQuery : IQuery<IReadOnlyList<StorefrontCategoryDto>>;

public sealed record GetStorefrontCheckoutVariantsQuery(IReadOnlyList<Guid> ProductIds) : IQuery<IReadOnlyList<StorefrontCheckoutVariantDto>>;
