using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Seo.Application.Sites.Dtos;
using Softaxis.Seo.Application.Sites.Queries;
using Softaxis.Seo.Infrastructure.Persistence;

namespace Softaxis.Seo.Infrastructure.Handlers.Sites;

internal sealed class GetSitesHandler(SeoDbContext db) : IQueryHandler<GetSitesQuery, IReadOnlyList<SiteDto>>
{
    public async Task<Result<IReadOnlyList<SiteDto>>> Handle(GetSitesQuery query, CancellationToken ct)
    {
        var sites = await db.Sites.AsNoTracking().OrderByDescending(s => s.CreatedAt).ToListAsync(ct);
        var connectedSiteIds = await db.GoogleIntegrations.AsNoTracking()
            .Where(g => g.Status == "connected")
            .Select(g => g.SiteId)
            .ToListAsync(ct);
        var connectedSet = connectedSiteIds.ToHashSet();

        var dtos = sites.Select(s => SiteMappings.ToDto(s, connectedSet.Contains(s.Id))).ToList();
        return Result.Success<IReadOnlyList<SiteDto>>(dtos);
    }
}
