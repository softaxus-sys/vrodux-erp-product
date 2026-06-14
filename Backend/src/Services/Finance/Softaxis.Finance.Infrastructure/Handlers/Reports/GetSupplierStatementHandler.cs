using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Reports.Dtos;
using Softaxis.Finance.Application.Reports.Queries;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Reports;

internal sealed class GetSupplierStatementHandler(FinanceDbContext db) : IQueryHandler<GetSupplierStatementQuery, StatementDto>
{
    public async Task<Result<StatementDto>> Handle(GetSupplierStatementQuery query, CancellationToken ct)
    {
        var supplier = await db.Suppliers.AsNoTracking().FirstOrDefaultAsync(x => x.Id == query.SupplierId, ct);

        if (supplier is null)
            return Result.Failure<StatementDto>(Error.NotFoundById(nameof(Supplier), query.SupplierId));

        var bills = await db.PurchaseBills.AsNoTracking().Include(x => x.Items)
            .Where(x => x.SupplierId == query.SupplierId && x.Status != "draft" && x.Status != "cancelled")
            .ToListAsync(ct);

        var payments = await db.PaymentVouchers.AsNoTracking()
            .Where(x => x.SupplierId == query.SupplierId && x.Status == "posted")
            .ToListAsync(ct);

        var entries = bills
            .Select(x => (date: x.BillDate, type: "Bill", reference: x.BillNumber, debit: x.Total, credit: 0m))
            .Concat(payments.Select(x => (date: x.PaymentDate, type: "Payment", reference: x.VoucherNumber, debit: 0m, credit: x.Amount)))
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
            supplier.Id, supplier.Name, lines, lines.Sum(l => l.Debit), lines.Sum(l => l.Credit), balance));
    }
}
