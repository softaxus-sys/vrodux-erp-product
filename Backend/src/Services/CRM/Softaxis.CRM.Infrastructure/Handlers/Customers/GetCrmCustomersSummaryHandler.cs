using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Customers.Dtos;
using Softaxis.CRM.Application.Customers.Queries;
using Softaxis.CRM.Infrastructure.Persistence;
using Softaxis.CRM.Infrastructure.Services;

namespace Softaxis.CRM.Infrastructure.Handlers.Customers;

internal sealed class GetCrmCustomersSummaryHandler(CrmDbContext db, ILeadAccessGuard access) : IQueryHandler<GetCrmCustomersSummaryQuery, CrmCustomersSummaryDto>
{
    public async Task<Result<CrmCustomersSummaryDto>> Handle(GetCrmCustomersSummaryQuery query, CancellationToken ct)
    {
        // Totals follow the caller's customers tier, so the stat cards agree with the list below.
        var all = await access.ScopeCustomers(db.Customers.AsNoTracking()).Where(x => !x.IsDeleted)
            .Select(x => new { x.Id, x.Status, x.Tier, x.NpsScore }).ToListAsync(ct);

        var withNps = all.Where(x => x.NpsScore.HasValue).ToList();

        // Derived from deals, like the cards in the list — a stat card that disagrees with the rows
        // under it is worse than no stat card.
        var metrics = await CustomerDealMetricsQuery.ForAsync(access.ScopeDeals(db.Deals.AsNoTracking()), [.. all.Select(x => x.Id)], ct);

        return Result.Success(new CrmCustomersSummaryDto(
            all.Count,
            all.Count(x => x.Status == "active"),
            all.Count(x => x.Status == "inactive"),
            all.Count(x => x.Tier == "platinum"),
            all.Count(x => x.Tier == "gold"),
            all.Sum(x => metrics.Of(x.Id).Revenue),
            all.Sum(x => metrics.Of(x.Id).OpenDeals),
            withNps.Count != 0 ? withNps.Average(x => x.NpsScore!.Value) : 0));
    }
}
