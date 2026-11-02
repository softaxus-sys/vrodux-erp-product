using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Ecommerce.Application.Shop;

public sealed record ShopFileDto(byte[] Data, string ContentType);

/// <summary>A product photo. Served only while the listing is published, so unpublished stock cannot be seen by guessing an address.</summary>
public sealed record GetShopImageQuery(string Slug, Guid TemplateId, Guid ImageId) : IQuery<ShopFileDto>;

/// <summary>A picture the store uploaded for its logo, banners and pages.</summary>
public sealed record GetShopAssetQuery(string Slug, Guid AssetId) : IQuery<ShopFileDto>;
