using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.PurchaseBills.Dtos;
using Softaxis.Finance.Application.PurchaseBills.Queries;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.PurchaseBills;

internal sealed class GetPurchaseBillsHandler(FinanceDbContext db) : IQueryHandler<GetPurchaseBillsQuery, PagedResult<PurchaseBillSummaryDto>>
{
    public async Task<Result<PagedResult<PurchaseBillSummaryDto>>> Handle(GetPurchaseBillsQuery query, CancellationToken ct)
    {
        IQueryable<PurchaseBill> q = db.PurchaseBills.AsNoTracking().Include(x => x.Items);

        if (!string.IsNullOrWhiteSpace(query.Search))
            q = q.Where(x => x.BillNumber.Contains(query.Search) || x.SupplierName.Contains(query.Search));

        if (!string.IsNullOrWhiteSpace(query.Status))
            q = q.Where(x => x.Status == query.Status);

        if (query.SupplierId is not null)
            q = q.Where(x => x.SupplierId == query.SupplierId);

        if (query.Outstanding == true)
            q = q.Where(x => x.Status == "approved" || x.Status == "partially_paid");

        var total      = await q.CountAsync(ct);
        var totalPages = (int)Math.Ceiling((double)total / query.PageSize);

        var items = await q
            .OrderByDescending(x => x.CreatedAt)
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .Select(x => new PurchaseBillSummaryDto(
                x.Id, x.BillNumber, x.SupplierId, x.SupplierName,
                x.BillDate, x.DueDate, x.TaxRate,
                x.Items.Sum(i => i.Quantity * i.UnitPrice),
                x.Items.Sum(i => i.Quantity * i.UnitPrice) * x.TaxRate / 100,
                x.Items.Sum(i => i.Quantity * i.UnitPrice) + x.Items.Sum(i => i.Quantity * i.UnitPrice) * x.TaxRate / 100,
                x.AmountPaid,
                (x.Items.Sum(i => i.Quantity * i.UnitPrice) + x.Items.Sum(i => i.Quantity * i.UnitPrice) * x.TaxRate / 100) - x.AmountPaid,
                x.Status, x.Items.Count, x.CreatedAt, x.UpdatedAt))
            .ToListAsync(ct);

        return Result.Success(new PagedResult<PurchaseBillSummaryDto>(
            items, query.Page, query.PageSize, total, totalPages,
            query.Page < totalPages, query.Page > 1));
    }
}
