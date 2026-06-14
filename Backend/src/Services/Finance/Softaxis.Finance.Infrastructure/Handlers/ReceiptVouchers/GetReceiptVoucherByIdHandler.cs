using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.ReceiptVouchers.Dtos;
using Softaxis.Finance.Application.ReceiptVouchers.Queries;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.ReceiptVouchers;

internal sealed class GetReceiptVoucherByIdHandler(FinanceDbContext db) : IQueryHandler<GetReceiptVoucherByIdQuery, ReceiptVoucherDto>
{
    public async Task<Result<ReceiptVoucherDto>> Handle(GetReceiptVoucherByIdQuery query, CancellationToken ct)
    {
        var voucher = await db.ReceiptVouchers.Include(x => x.Allocations)
            .FirstOrDefaultAsync(x => x.Id == query.Id, ct);

        if (voucher is null)
            return Result.Failure<ReceiptVoucherDto>(Error.NotFoundById(nameof(ReceiptVoucher), query.Id));

        var invoiceIds = voucher.Allocations.Select(a => a.InvoiceId).ToList();
        var invoices = await db.Invoices.Include(x => x.Items)
            .Where(x => invoiceIds.Contains(x.Id)).ToListAsync(ct);

        var invoicesById = invoices.ToDictionary(x => x.Id);
        return Result.Success(ReceiptVoucherMappings.ToDto(voucher, invoicesById));
    }
}
