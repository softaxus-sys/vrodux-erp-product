using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.PaymentVouchers.Dtos;
using Softaxis.Finance.Application.PaymentVouchers.Queries;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.PaymentVouchers;

internal sealed class GetPaymentVouchersHandler(FinanceDbContext db)
    : IQueryHandler<GetPaymentVouchersQuery, PagedResult<PaymentVoucherSummaryDto>>
{
    public async Task<Result<PagedResult<PaymentVoucherSummaryDto>>> Handle(GetPaymentVouchersQuery query, CancellationToken ct)
    {
        var q = db.PaymentVouchers.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim();
            q = q.Where(x => x.VoucherNumber.Contains(term) || x.SupplierName.Contains(term));
        }

        if (!string.IsNullOrWhiteSpace(query.Status))
            q = q.Where(x => x.Status == query.Status);

        if (query.SupplierId is not null)
            q = q.Where(x => x.SupplierId == query.SupplierId);

        var totalCount = await q.CountAsync(ct);

        var page = query.Page < 1 ? 1 : query.Page;
        var pageSize = query.PageSize < 1 ? 20 : query.PageSize;

        var items = await q
            .OrderByDescending(x => x.PaymentDate)
            .ThenByDescending(x => x.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new PaymentVoucherSummaryDto(
                x.Id, x.VoucherNumber, x.SupplierId, x.SupplierName,
                x.PaymentDate, x.Amount, x.PaymentMethod, x.Status,
                x.Allocations.Count, x.CreatedAt, x.UpdatedAt))
            .ToListAsync(ct);

        var totalPages = pageSize == 0 ? 0 : (int)Math.Ceiling(totalCount / (double)pageSize);

        return Result.Success(new PagedResult<PaymentVoucherSummaryDto>(
            items, page, pageSize, totalCount, totalPages, page < totalPages, page > 1));
    }
}
