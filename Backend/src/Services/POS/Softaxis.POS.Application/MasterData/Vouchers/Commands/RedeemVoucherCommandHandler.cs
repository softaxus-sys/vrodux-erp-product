using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.MasterData.Vouchers.Commands;

/// <summary>
/// Validate a voucher against a cart subtotal and CONSUME it (increment usage).
/// Used by external flows (e.g. the Restaurant POS) that apply a coupon outside
/// of the standard retail CreateSale pipeline.
/// </summary>
public sealed record RedeemVoucherCommand(string Code, decimal Subtotal) : ICommand<VoucherValidationDto>;

public sealed class RedeemVoucherCommandHandler(IVoucherRepository repo, IUnitOfWork uow)
    : ICommandHandler<RedeemVoucherCommand, VoucherValidationDto>
{
    public async Task<Result<VoucherValidationDto>> Handle(RedeemVoucherCommand cmd, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(cmd.Code))
            return Result.Success(new VoucherValidationDto(false, 0, "Enter a voucher code.", null));

        var voucher = await repo.GetByCodeAsync(cmd.Code, ct);
        if (voucher is null)
            return Result.Success(new VoucherValidationDto(false, 0, "Voucher code not found.", null));

        var check = voucher.Validate(cmd.Subtotal, DateTime.UtcNow);
        if (check.IsFailure)
            return Result.Success(new VoucherValidationDto(
                false, 0, check.Error.Description, UpsertVoucherCommandHandler.Map(voucher)));

        var discount = voucher.ComputeDiscount(cmd.Subtotal);
        voucher.IncrementUsage();
        repo.Update(voucher);
        await uow.SaveChangesAsync(ct);

        return Result.Success(new VoucherValidationDto(
            true, discount, null, UpsertVoucherCommandHandler.Map(voucher)));
    }
}
