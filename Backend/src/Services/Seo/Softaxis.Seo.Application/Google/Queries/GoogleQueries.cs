using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Seo.Application.Google.Dtos;

namespace Softaxis.Seo.Application.Google.Queries;

public sealed record GetGooglePropertiesQuery(Guid SiteId) : IQuery<GooglePropertiesResultDto>;
