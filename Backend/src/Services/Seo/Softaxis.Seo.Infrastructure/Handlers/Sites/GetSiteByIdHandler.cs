using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Seo.Application.Sites.Dtos;
using Softaxis.Seo.Application.Sites.Queries;
using Softaxis.Seo.Infrastructure.Persistence;

namespace Softaxis.Seo.Infrastructure.Handlers.Sites;

internal sealed class GetSiteByIdHandler(SeoDbContext db) : IQueryHandler<GetSiteByIdQuery, SiteDto>
{
    public async Task<Result<SiteDto>> Handle(GetSiteByIdQuery query, CancellationToken ct)
    {
        var site = await db.Sites.AsNoTracking().FirstOrDefaultAsync(s => s.Id == query.Id, ct);
        if (site is null) return Result.Failure<SiteDto>(Error.NotFoundById("SeoSite", query.Id));

        var connected = await db.GoogleIntegrations.AsNoTracking()
            .AnyAsync(g => g.SiteId == site.Id && g.Status == "connected", ct);

        return Result.Success(SiteMappings.ToDto(site, connected));
    }
}
