using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;

namespace Softaxis.Inventory.Application.ProductTemplates;

public sealed record GetProductTemplatesQuery(
    int     Page            = 1,
    int     PageSize        = 20,
    string? Search          = null,
    Guid?   CategoryId      = null,
    bool?   PublishedOnline = null) : IQuery<PagedResult<ProductTemplateSummaryDto>>;

public sealed record GetProductTemplateByIdQuery(Guid Id) : IQuery<ProductTemplateDto>;

/// <summary>What stands between a listing and going live — shown before the user presses Publish.</summary>
public sealed record GetPublishCheckQuery(Guid Id) : IQuery<PublishCheckDto>;

/// <summary>Active stock items that belong to no online listing — the "to list" worklist.</summary>
public sealed record GetUnlistedProductsQuery(int Page = 1, int PageSize = 20, string? Search = null, Guid? CategoryId = null)
    : IQuery<PagedResult<UnlistedProductDto>>;

/// <summary>For the stock list: which of these items are online, and whether live. Max 200 ids.</summary>
public sealed record GetProductListingStatusQuery(IReadOnlyList<Guid> ProductIds)
    : IQuery<IReadOnlyList<ProductListingStatusDto>>;

public sealed record GetTemplateImageQuery(Guid TemplateId, Guid ImageId) : IQuery<ProductImageFileDto>;
