using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Reports.Dtos;
using Softaxis.Finance.Application.Reports.Queries;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Reports;

internal sealed class GetCustomerStatementHandler(FinanceDbContext db) : IQueryHandler<GetCustomerStatementQuery, StatementDto>
{
    public async Task<Result<StatementDto>> Handle(GetCustomerStatementQuery query, CancellationToken ct)
    {
        var customer = await db.Customers.AsNoTracking().FirstOrDefaultAsync(x => x.Id == query.CustomerId, ct);

        if (customer is null)
            return Result.Failure<StatementDto>(Error.NotFoundById(nameof(Customer), query.CustomerId));

        var invoices = await db.Invoices.AsNoTracking().Include(x => x.Items)
            .Where(x => x.CustomerId == query.CustomerId && x.Status != "draft" && x.Status != "cancelled")
            .ToListAsync(ct);

        var receipts = await db.ReceiptVouchers.AsNoTracking()
            .Where(x => x.CustomerId == query.CustomerId && x.Status == "posted")
            .ToListAsync(ct);

        var entries = invoices
            .Select(x => (date: x.InvoiceDate, type: "Invoice", reference: x.InvoiceNumber, debit: x.Total, credit: 0m))
            .Concat(receipts.Select(x => (date: x.ReceiptDate, type: "Receipt", reference: x.VoucherNumber, debit: 0m, credit: x.Amount)))
            .Where(e => (query.From is null || e.date.CompareTo(query.From) >= 0) && (query.To is null || e.date.CompareTo(query.To) <= 0))
            .OrderBy(e => e.date)
            .ToList();

        var balance = 0m;
        var lines = entries.Select(e =>
        {
            balance += e.debit - e.credit;
            return new StatementLineDto(e.date, e.type, e.reference, e.debit, e.credit, balance);
        }).ToList();

        return Result.Success(new StatementDto(
            customer.Id, customer.Name, lines, lines.Sum(l => l.Debit), lines.Sum(l => l.Credit), balance));
    }
}
