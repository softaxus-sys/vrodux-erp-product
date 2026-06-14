using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.RealEstate.Application.Sales.Dtos;
using Softaxis.RealEstate.Application.Sales.Queries;
using Softaxis.RealEstate.Infrastructure.Persistence;

namespace Softaxis.RealEstate.Infrastructure.Handlers.Sales;

internal sealed class GetSiteVisitsHandler(RealEstateDbContext db)
    : IQueryHandler<GetSiteVisitsQuery, IReadOnlyList<SiteVisitDto>>
{
    public async Task<Result<IReadOnlyList<SiteVisitDto>>> Handle(GetSiteVisitsQuery query, CancellationToken ct)
    {
        var q = db.SiteVisits.AsNoTracking().AsQueryable();
        if (query.LeadId.HasValue) q = q.Where(x => x.LeadId == query.LeadId.Value);

        var items = await q.OrderByDescending(x => x.CreatedAt).ToListAsync(ct);
        return Result.Success<IReadOnlyList<SiteVisitDto>>(items.Select(SalesMappings.ToDto).ToList());
    }
}
