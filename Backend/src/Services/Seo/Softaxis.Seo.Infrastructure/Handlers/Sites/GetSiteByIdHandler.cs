using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Seo.Application.Sites.Dtos;
using Softaxis.Seo.Application.Sites.Queries;
using Softaxis.Seo.Domain.Entities;
using Softaxis.Seo.Infrastructure.Persistence;

namespace Softaxis.Seo.Infrastructure.Handlers.Sites;

internal sealed class GetSiteByIdHandler(SeoDbContext db) : IQueryHandler<GetSiteByIdQuery, SiteDto>
{
    public async Task<Result<SiteDto>> Handle(GetSiteByIdQuery query, CancellationToken ct)
    {
        var site = await db.Sites.AsNoTracking().FirstOrDefaultAsync(s => s.Id == query.Id, ct);
        if (site is null) return Result.Failure<SiteDto>(Error.NotFoundById("SeoSite", query.Id));

        var integration = await db.GoogleIntegrations.AsNoTracking()
            .FirstOrDefaultAsync(g => g.SiteId == site.Id && g.Status == "connected", ct);

        string? gsc = null, ga4 = null;
        if (integration is not null)
        {
            var resources = await db.GoogleResources.AsNoTracking()
                .Where(r => r.IntegrationId == integration.Id).ToListAsync(ct);
            gsc = resources.FirstOrDefault(r => r.ResourceType == SeoGoogleResourceTypes.GscProperty)?.Name;
            ga4 = resources.FirstOrDefault(r => r.ResourceType == SeoGoogleResourceTypes.Ga4Property)?.Name;
        }

        return Result.Success(SiteMappings.ToDto(site, integration is not null, gsc, ga4));
    }
}
