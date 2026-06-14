using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Invoices.Dtos;
using Softaxis.Finance.Application.Invoices.Queries;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Invoices;

internal sealed class GetInvoicesSummaryHandler(FinanceDbContext db) : IQueryHandler<GetInvoicesSummaryQuery, InvoicesSummaryDto>
{
    public async Task<Result<InvoicesSummaryDto>> Handle(GetInvoicesSummaryQuery query, CancellationToken ct)
    {
        var all = await db.Invoices.AsNoTracking().Include(x => x.Items)
            .Select(x => new { x.Status, Total = x.Items.Sum(i => i.Quantity * i.UnitPrice) * (1 + x.TaxRate / 100) })
            .ToListAsync(ct);

        return Result.Success(new InvoicesSummaryDto(
            all.Count,
            all.Sum(x => x.Total),
            all.Where(x => x.Status == "paid").Sum(x => x.Total),
            all.Where(x => x.Status == "overdue").Sum(x => x.Total),
            all.Where(x => x.Status is "sent" or "overdue").Sum(x => x.Total),
            all.Count(x => x.Status == "draft")));
    }
}
