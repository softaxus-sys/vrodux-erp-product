using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Seo.Application.Fixes.Dtos;

namespace Softaxis.Seo.Application.Fixes.Queries;

public sealed record GetFixesQuery(Guid SiteId, string? Status) : IQuery<IReadOnlyList<FixDto>>;
