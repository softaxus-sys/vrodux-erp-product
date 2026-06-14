using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.RecurringInvoices.Dtos;
using Softaxis.Finance.Application.RecurringInvoices.Queries;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.RecurringInvoices;

internal sealed class GetRecurringInvoicesSummaryHandler(FinanceDbContext db) : IQueryHandler<GetRecurringInvoicesSummaryQuery, RecurringInvoicesSummaryDto>
{
    public async Task<Result<RecurringInvoicesSummaryDto>> Handle(GetRecurringInvoicesSummaryQuery query, CancellationToken ct)
    {
        var all = await db.RecurringInvoices.AsNoTracking().Include(r => r.Lines).ToListAsync(ct);
        var today = DateTime.UtcNow.Date;

        return Result.Success(new RecurringInvoicesSummaryDto(
            all.Count,
            all.Count(r => r.IsActive),
            all.Count(r => r.IsActive && r.NextRunDate.Date <= today.AddDays(7)),
            all.Sum(r => r.GeneratedCount),
            all.Where(r => r.IsActive && r.Frequency == "monthly")
               .Sum(r => { var s = r.Lines.Sum(l => l.Quantity * l.UnitPrice); return s + s * r.TaxRate / 100m; })));
    }
}
