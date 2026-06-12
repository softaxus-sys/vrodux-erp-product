using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.PurchaseBills.Dtos;
using Softaxis.Finance.Application.PurchaseBills.Queries;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.PurchaseBills;

internal sealed class GetPurchaseBillsSummaryHandler(FinanceDbContext db) : IQueryHandler<GetPurchaseBillsSummaryQuery, PurchaseBillsSummaryDto>
{
    public async Task<Result<PurchaseBillsSummaryDto>> Handle(GetPurchaseBillsSummaryQuery query, CancellationToken ct)
    {
        var all = await db.PurchaseBills.AsNoTracking().Include(x => x.Items)
            .Select(x => new
            {
                x.Status,
                x.AmountPaid,
                Total = x.Items.Sum(i => i.Quantity * i.UnitPrice) * (1 + x.TaxRate / 100),
            })
            .ToListAsync(ct);

        return Result.Success(new PurchaseBillsSummaryDto(
            all.Count,
            all.Sum(x => x.Total),
            all.Sum(x => x.AmountPaid),
            all.Sum(x => x.Total - x.AmountPaid),
            all.Count(x => x.Status == "draft"),
            all.Count(x => x.Status is "approved" or "partially_paid")));
    }
}
