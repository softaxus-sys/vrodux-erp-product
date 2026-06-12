using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.ReceiptVouchers.Commands;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Handlers.GeneralLedger;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.ReceiptVouchers;

internal sealed class VoidReceiptVoucherHandler(FinanceDbContext db) : ICommandHandler<VoidReceiptVoucherCommand>
{
    public async Task<Result> Handle(VoidReceiptVoucherCommand cmd, CancellationToken ct)
    {
        var voucher = await db.ReceiptVouchers.Include(x => x.Allocations)
            .FirstOrDefaultAsync(x => x.Id == cmd.Id, ct);

        if (voucher is null)
            return Result.Failure(Error.NotFoundById(nameof(ReceiptVoucher), cmd.Id));

        if (voucher.Status == "void")
            return Result.Failure(Error.Custom("ReceiptVoucher.Conflict", "Receipt voucher is already void."));

        if (voucher.Status == "posted")
        {
            var invoiceIds = voucher.Allocations.Select(a => a.InvoiceId).ToList();
            var invoices = await db.Invoices.Where(x => invoiceIds.Contains(x.Id)).ToListAsync(ct);

            foreach (var allocation in voucher.Allocations)
            {
                var invoice = invoices.FirstOrDefault(x => x.Id == allocation.InvoiceId);
                invoice?.ReversePayment(allocation.AmountApplied);
            }

            await GlPoster.VoidAsync(db, voucher.JournalEntryId, ct);
            voucher.SetJournalEntryId(null);
        }

        voucher.Void();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
