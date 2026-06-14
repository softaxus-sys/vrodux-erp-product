using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Invoices.Dtos;
using Softaxis.Finance.Application.Invoices.Queries;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Invoices;

internal sealed class GetInvoicesHandler(FinanceDbContext db) : IQueryHandler<GetInvoicesQuery, PagedResult<InvoiceSummaryDto>>
{
    public async Task<Result<PagedResult<InvoiceSummaryDto>>> Handle(GetInvoicesQuery query, CancellationToken ct)
    {
        IQueryable<Invoice> q = db.Invoices.AsNoTracking().Include(x => x.Items);

        if (!string.IsNullOrWhiteSpace(query.Search))
            q = q.Where(x => x.InvoiceNumber.Contains(query.Search) || x.CustomerName.Contains(query.Search));

        if (!string.IsNullOrWhiteSpace(query.Status))
            q = q.Where(x => x.Status == query.Status);

        var total      = await q.CountAsync(ct);
        var totalPages = (int)Math.Ceiling((double)total / query.PageSize);

        var items = await q
            .OrderByDescending(x => x.CreatedAt)
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .Select(x => new InvoiceSummaryDto(
                x.Id, x.InvoiceNumber, x.CustomerName, x.CustomerEmail,
                x.InvoiceDate, x.DueDate, x.TaxRate,
                x.Items.Sum(i => i.Quantity * i.UnitPrice),
                x.Items.Sum(i => i.Quantity * i.UnitPrice) * x.TaxRate / 100,
                x.Items.Sum(i => i.Quantity * i.UnitPrice) + x.Items.Sum(i => i.Quantity * i.UnitPrice) * x.TaxRate / 100,
                x.Status, x.Items.Count, x.PaidAt, x.CreatedAt, x.UpdatedAt))
            .ToListAsync(ct);

        return Result.Success(new PagedResult<InvoiceSummaryDto>(
            items, query.Page, query.PageSize, total, totalPages,
            query.Page < totalPages, query.Page > 1));
    }
}
