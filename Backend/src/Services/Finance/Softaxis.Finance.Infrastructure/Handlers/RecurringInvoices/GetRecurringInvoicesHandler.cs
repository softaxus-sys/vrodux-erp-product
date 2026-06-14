using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.RecurringInvoices.Dtos;
using Softaxis.Finance.Application.RecurringInvoices.Queries;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.RecurringInvoices;

internal sealed class GetRecurringInvoicesHandler(FinanceDbContext db) : IQueryHandler<GetRecurringInvoicesQuery, IReadOnlyList<RecurringDto>>
{
    public async Task<Result<IReadOnlyList<RecurringDto>>> Handle(GetRecurringInvoicesQuery query, CancellationToken ct)
    {
        var items = await db.RecurringInvoices.AsNoTracking().Include(r => r.Lines)
            .OrderByDescending(r => r.IsActive).ThenBy(r => r.NextRunDate).ToListAsync(ct);

        return Result.Success<IReadOnlyList<RecurringDto>>(items.Select(RecurringInvoiceMappings.ToDto).ToList());
    }
}
