using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Construction.Application.Sites.Dtos;
using Softaxis.Construction.Application.Sites.Queries;
using Softaxis.Construction.Infrastructure.Persistence;

namespace Softaxis.Construction.Infrastructure.Handlers.Sites;

internal sealed class GetSitesSummaryHandler(ConstructionDbContext db)
    : IQueryHandler<GetSitesSummaryQuery, SitesSummaryDto>
{
    public async Task<Result<SitesSummaryDto>> Handle(GetSitesSummaryQuery query, CancellationToken ct)
    {
        var all = await db.Sites.AsNoTracking().Where(x => !x.IsDeleted)
            .Select(x => new { x.Status, x.CurrentWorkers, x.SafetyScore, x.PermitExpiry }).ToListAsync(ct);

        var soon = DateTime.UtcNow.AddDays(30).ToString("yyyy-MM-dd");

        var dto = new SitesSummaryDto(
            all.Count,
            all.Count(x => x.Status == "active"),
            all.Count(x => x.Status == "inactive"),
            all.Count(x => x.Status == "completed"),
            all.Sum(x => x.CurrentWorkers),
            all.Count > 0 ? all.Average(x => x.SafetyScore) : 0,
            all.Count(x => string.Compare(x.PermitExpiry, soon, StringComparison.Ordinal) <= 0));

        return Result.Success(dto);
    }
}
