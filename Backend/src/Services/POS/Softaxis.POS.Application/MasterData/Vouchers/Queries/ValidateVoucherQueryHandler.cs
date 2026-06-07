using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Application.MasterData.Vouchers.Commands;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.MasterData.Vouchers.Queries;

/// <summary>
/// Validate a voucher code against a cart subtotal and preview the discount.
/// Read-only — does NOT consume the voucher (usage is incremented only at sale time).
/// </summary>
public sealed record ValidateVoucherQuery(string Code, decimal Subtotal)
    : IQuery<VoucherValidationDto>;

public sealed class ValidateVoucherQueryHandler(IVoucherRepository repo)
    : IQueryHandler<ValidateVoucherQuery, VoucherValidationDto>
{
    public async Task<Result<VoucherValidationDto>> Handle(ValidateVoucherQuery q, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(q.Code))
            return Result.Success(new VoucherValidationDto(false, 0, "Enter a voucher code.", null));

        var voucher = await repo.GetByCodeAsync(q.Code, ct);
        if (voucher is null)
            return Result.Success(new VoucherValidationDto(false, 0, "Voucher code not found.", null));

        var check = voucher.Validate(q.Subtotal, DateTime.UtcNow);
        if (check.IsFailure)
            return Result.Success(new VoucherValidationDto(
                false, 0, check.Error.Description, UpsertVoucherCommandHandler.Map(voucher)));

        var discount = voucher.ComputeDiscount(q.Subtotal);
        return Result.Success(new VoucherValidationDto(
            true, discount, null, UpsertVoucherCommandHandler.Map(voucher)));
    }
}
