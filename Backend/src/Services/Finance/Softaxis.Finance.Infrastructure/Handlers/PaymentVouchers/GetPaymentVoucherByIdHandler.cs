using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.PaymentVouchers.Dtos;
using Softaxis.Finance.Application.PaymentVouchers.Queries;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.PaymentVouchers;

internal sealed class GetPaymentVoucherByIdHandler(FinanceDbContext db) : IQueryHandler<GetPaymentVoucherByIdQuery, PaymentVoucherDto>
{
    public async Task<Result<PaymentVoucherDto>> Handle(GetPaymentVoucherByIdQuery query, CancellationToken ct)
    {
        var voucher = await db.PaymentVouchers.Include(x => x.Allocations)
            .FirstOrDefaultAsync(x => x.Id == query.Id, ct);

        if (voucher is null)
            return Result.Failure<PaymentVoucherDto>(Error.NotFoundById(nameof(PaymentVoucher), query.Id));

        var billIds = voucher.Allocations.Select(a => a.BillId).ToList();
        var bills = await db.PurchaseBills.Include(x => x.Items)
            .Where(x => billIds.Contains(x.Id)).ToListAsync(ct);

        var billsById = bills.ToDictionary(x => x.Id);
        return Result.Success(PaymentVoucherMappings.ToDto(voucher, billsById));
    }
}
