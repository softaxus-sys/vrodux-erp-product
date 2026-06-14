using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Construction.Application.Sites.Dtos;

namespace Softaxis.Construction.Application.Sites.Queries;

public sealed record GetSitesQuery : IQuery<IReadOnlyList<SiteDto>>;

public sealed record GetSitesSummaryQuery : IQuery<SitesSummaryDto>;
