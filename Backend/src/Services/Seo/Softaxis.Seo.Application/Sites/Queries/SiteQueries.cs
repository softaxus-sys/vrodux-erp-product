using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Seo.Application.Sites.Dtos;

namespace Softaxis.Seo.Application.Sites.Queries;

public sealed record GetSitesQuery : IQuery<IReadOnlyList<SiteDto>>;
public sealed record GetSiteByIdQuery(Guid Id) : IQuery<SiteDto>;
