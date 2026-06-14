using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Construction.Application.Sites.Dtos;
using Softaxis.Construction.Application.Sites.Queries;
using Softaxis.Construction.Infrastructure.Persistence;

namespace Softaxis.Construction.Infrastructure.Handlers.Sites;

internal sealed class GetSitesHandler(ConstructionDbContext db)
    : IQueryHandler<GetSitesQuery, IReadOnlyList<SiteDto>>
{
    public async Task<Result<IReadOnlyList<SiteDto>>> Handle(GetSitesQuery query, CancellationToken ct)
    {
        var items = await db.Sites.AsNoTracking().Where(x => !x.IsDeleted)
            .OrderBy(x => x.Name).ToListAsync(ct);

        return Result.Success<IReadOnlyList<SiteDto>>(items.Select(SiteMappings.ToDto).ToList());
    }
}
