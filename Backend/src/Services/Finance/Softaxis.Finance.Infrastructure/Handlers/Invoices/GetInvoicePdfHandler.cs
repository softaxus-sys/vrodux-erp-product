using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Invoices.Queries;
using Softaxis.Finance.Infrastructure.Persistence;
using Softaxis.Finance.Infrastructure.Services;

namespace Softaxis.Finance.Infrastructure.Handlers.Invoices;

internal sealed class GetInvoicePdfHandler(FinanceDbContext db)
    : IQueryHandler<GetInvoicePdfQuery, InvoicePdfDto>
{
    public async Task<Result<InvoicePdfDto>> Handle(GetInvoicePdfQuery query, CancellationToken ct)
    {
        var invoice = await db.Invoices.AsNoTracking()
            .Include(i => i.Items)
            .FirstOrDefaultAsync(i => i.Id == query.Id && !i.IsDeleted, ct);

        if (invoice is null)
            return Result.Failure<InvoicePdfDto>(Error.NotFoundById("Invoice", query.Id));

        // Same builder and same letterhead the emailed attachment uses, so what staff download and
        // what the customer receives cannot disagree.
        var branding = await RecurringInvoiceGenerator.ResolveBrandingAsync(db, ct);

        return Result.Success(new InvoicePdfDto(
            InvoicePdfBuilder.FileName(invoice),
            InvoicePdfBuilder.Build(invoice, branding)));
    }
}
