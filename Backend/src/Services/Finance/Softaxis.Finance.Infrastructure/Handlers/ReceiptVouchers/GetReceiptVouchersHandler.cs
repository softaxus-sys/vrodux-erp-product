using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.ReceiptVouchers.Dtos;
using Softaxis.Finance.Application.ReceiptVouchers.Queries;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.ReceiptVouchers;

internal sealed class GetReceiptVouchersHandler(FinanceDbContext db)
    : IQueryHandler<GetReceiptVouchersQuery, PagedResult<ReceiptVoucherSummaryDto>>
{
    public async Task<Result<PagedResult<ReceiptVoucherSummaryDto>>> Handle(GetReceiptVouchersQuery query, CancellationToken ct)
    {
        var q = db.ReceiptVouchers.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim();
            q = q.Where(x => x.VoucherNumber.Contains(term) || x.CustomerName.Contains(term));
        }

        if (!string.IsNullOrWhiteSpace(query.Status))
            q = q.Where(x => x.Status == query.Status);

        if (query.CustomerId is not null)
            q = q.Where(x => x.CustomerId == query.CustomerId);

        var totalCount = await q.CountAsync(ct);

        var page = query.Page < 1 ? 1 : query.Page;
        var pageSize = query.PageSize < 1 ? 20 : query.PageSize;

        var items = await q
            .OrderByDescending(x => x.ReceiptDate)
            .ThenByDescending(x => x.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new ReceiptVoucherSummaryDto(
                x.Id, x.VoucherNumber, x.CustomerId, x.CustomerName,
                x.ReceiptDate, x.Amount, x.ReceiptMethod, x.Status,
                x.Allocations.Count, x.CreatedAt, x.UpdatedAt))
            .ToListAsync(ct);

        var totalPages = pageSize == 0 ? 0 : (int)Math.Ceiling(totalCount / (double)pageSize);

        return Result.Success(new PagedResult<ReceiptVoucherSummaryDto>(
            items, page, pageSize, totalCount, totalPages, page < totalPages, page > 1));
    }
}
