using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.PaymentVouchers.Commands;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.PaymentVouchers;

internal sealed class DeletePaymentVoucherHandler(FinanceDbContext db) : ICommandHandler<DeletePaymentVoucherCommand>
{
    public async Task<Result> Handle(DeletePaymentVoucherCommand cmd, CancellationToken ct)
    {
        var voucher = await db.PaymentVouchers.FirstOrDefaultAsync(x => x.Id == cmd.Id, ct);

        if (voucher is null)
            return Result.Failure(Error.NotFoundById(nameof(PaymentVoucher), cmd.Id));

        if (voucher.Status != "draft")
            return Result.Failure(Error.Custom("PaymentVoucher.HasTransactions", "Only draft payment vouchers can be deleted."));

        voucher.Delete();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
