using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Invoices.Dtos;
using Softaxis.Finance.Application.Invoices.Queries;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Invoices;

internal sealed class GetInvoiceByIdHandler(FinanceDbContext db) : IQueryHandler<GetInvoiceByIdQuery, InvoiceDto>
{
    public async Task<Result<InvoiceDto>> Handle(GetInvoiceByIdQuery query, CancellationToken ct)
    {
        var inv = await db.Invoices.AsNoTracking().Include(x => x.Items)
            .FirstOrDefaultAsync(x => x.Id == query.Id, ct);

        if (inv is null)
            return Result.Failure<InvoiceDto>(Error.NotFoundById("Invoice", query.Id));

        return Result.Success(InvoiceMappings.ToDto(inv));
    }
}
