using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.ReceiptVouchers.Commands;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.ReceiptVouchers;

internal sealed class DeleteReceiptVoucherHandler(FinanceDbContext db) : ICommandHandler<DeleteReceiptVoucherCommand>
{
    public async Task<Result> Handle(DeleteReceiptVoucherCommand cmd, CancellationToken ct)
    {
        var voucher = await db.ReceiptVouchers.FirstOrDefaultAsync(x => x.Id == cmd.Id, ct);

        if (voucher is null)
            return Result.Failure(Error.NotFoundById(nameof(ReceiptVoucher), cmd.Id));

        if (voucher.Status != "draft")
            return Result.Failure(Error.Custom("ReceiptVoucher.HasTransactions", "Only draft receipt vouchers can be deleted."));

        voucher.Delete();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
