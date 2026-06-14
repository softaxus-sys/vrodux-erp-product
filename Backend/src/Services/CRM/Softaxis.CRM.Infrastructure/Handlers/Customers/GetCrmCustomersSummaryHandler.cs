using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Customers.Dtos;
using Softaxis.CRM.Application.Customers.Queries;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Customers;

internal sealed class GetCrmCustomersSummaryHandler(CrmDbContext db) : IQueryHandler<GetCrmCustomersSummaryQuery, CrmCustomersSummaryDto>
{
    public async Task<Result<CrmCustomersSummaryDto>> Handle(GetCrmCustomersSummaryQuery query, CancellationToken ct)
    {
        var all = await db.Customers.AsNoTracking().Where(x => !x.IsDeleted)
            .Select(x => new { x.Status, x.Tier, x.TotalRevenue, x.OpenDeals, x.NpsScore }).ToListAsync(ct);

        var withNps = all.Where(x => x.NpsScore.HasValue).ToList();

        return Result.Success(new CrmCustomersSummaryDto(
            all.Count,
            all.Count(x => x.Status == "active"),
            all.Count(x => x.Status == "inactive"),
            all.Count(x => x.Tier == "platinum"),
            all.Count(x => x.Tier == "gold"),
            all.Sum(x => x.TotalRevenue),
            all.Sum(x => x.OpenDeals),
            withNps.Count != 0 ? withNps.Average(x => x.NpsScore!.Value) : 0));
    }
}
