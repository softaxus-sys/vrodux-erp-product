using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Finance.Application.ReceiptVouchers.Dtos;

namespace Softaxis.Finance.Application.ReceiptVouchers.Queries;

public sealed record GetReceiptVouchersQuery(
    int Page, int PageSize, string? Search, string? Status, Guid? CustomerId) : IQuery<PagedResult<ReceiptVoucherSummaryDto>>;

public sealed record GetReceiptVoucherByIdQuery(Guid Id) : IQuery<ReceiptVoucherDto>;
