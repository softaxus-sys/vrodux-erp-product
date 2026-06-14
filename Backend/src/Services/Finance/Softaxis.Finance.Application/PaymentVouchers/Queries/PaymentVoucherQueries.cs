using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Finance.Application.PaymentVouchers.Dtos;

namespace Softaxis.Finance.Application.PaymentVouchers.Queries;

public sealed record GetPaymentVouchersQuery(
    int Page, int PageSize, string? Search, string? Status, Guid? SupplierId) : IQuery<PagedResult<PaymentVoucherSummaryDto>>;

public sealed record GetPaymentVoucherByIdQuery(Guid Id) : IQuery<PaymentVoucherDto>;
