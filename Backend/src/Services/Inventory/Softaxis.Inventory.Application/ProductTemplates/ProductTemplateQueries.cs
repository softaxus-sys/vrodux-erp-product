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

public sealed record GetTemplateImageQuery(Guid TemplateId, Guid ImageId) : IQuery<ProductImageFileDto>;
