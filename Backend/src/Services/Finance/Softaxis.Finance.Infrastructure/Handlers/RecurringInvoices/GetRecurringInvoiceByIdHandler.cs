using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.RecurringInvoices.Dtos;
using Softaxis.Finance.Application.RecurringInvoices.Queries;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.RecurringInvoices;

internal sealed class GetRecurringInvoiceByIdHandler(FinanceDbContext db) : IQueryHandler<GetRecurringInvoiceByIdQuery, RecurringDto>
{
    public async Task<Result<RecurringDto>> Handle(GetRecurringInvoiceByIdQuery query, CancellationToken ct)
    {
        var r = await db.RecurringInvoices.AsNoTracking().Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == query.Id, ct);

        if (r is null)
            return Result.Failure<RecurringDto>(Error.NotFoundById("RecurringInvoice", query.Id));

        return Result.Success(RecurringInvoiceMappings.ToDto(r));
    }
}
