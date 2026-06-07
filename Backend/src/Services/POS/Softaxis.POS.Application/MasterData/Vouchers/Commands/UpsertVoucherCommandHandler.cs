using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Enums;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.MasterData.Vouchers.Commands;

public sealed record UpsertVoucherCommand(
    Guid?     Id,
    string    Code,
    string?   Description,
    int       ValueType,            // 1 = Percentage, 2 = FixedAmount
    decimal   Value,
    decimal   MinSpend,
    decimal?  MaxDiscountAmount,
    DateTime? ValidFrom,
    DateTime? ValidUntil,
    int?      UsageLimit,
    bool      IsActive
) : ICommand<VoucherDto>;

public sealed class UpsertVoucherCommandHandler(IVoucherRepository repo, IUnitOfWork uow)
    : ICommandHandler<UpsertVoucherCommand, VoucherDto>
{
    public async Task<Result<VoucherDto>> Handle(UpsertVoucherCommand cmd, CancellationToken ct)
    {
        if (await repo.CodeExistsAsync(cmd.Code, cmd.Id, ct))
            return Result.Failure<VoucherDto>(
                Error.Custom("Voucher.CodeTaken", $"Voucher code '{cmd.Code}' is already in use."));

        var valueType = (VoucherValueType)cmd.ValueType;
        Voucher voucher;

        if (cmd.Id is null)
        {
            var result = Voucher.Create(
                cmd.Code, cmd.Description, valueType, cmd.Value,
                cmd.MinSpend, cmd.MaxDiscountAmount, cmd.ValidFrom, cmd.ValidUntil,
                cmd.UsageLimit, cmd.IsActive);
            if (result.IsFailure) return Result.Failure<VoucherDto>(result.Error);
            voucher = result.Value;
            voucher.CreatedAt = DateTime.UtcNow;
            voucher.CreatedBy = "system";
            repo.Add(voucher);
        }
        else
        {
            voucher = await repo.GetByIdAsync(cmd.Id.Value, ct)
                ?? throw new InvalidOperationException($"Voucher {cmd.Id} not found.");
            var upd = voucher.Update(
                cmd.Code, cmd.Description, valueType, cmd.Value,
                cmd.MinSpend, cmd.MaxDiscountAmount, cmd.ValidFrom, cmd.ValidUntil,
                cmd.UsageLimit, cmd.IsActive);
            if (upd.IsFailure) return Result.Failure<VoucherDto>(upd.Error);
        }

        await uow.SaveChangesAsync(ct);
        return Result.Success(Map(voucher));
    }

    internal static VoucherDto Map(Voucher v) => new(
        v.Id, v.Code, v.Description, (int)v.ValueType, v.Value, v.MinSpend,
        v.MaxDiscountAmount, v.ValidFrom, v.ValidUntil, v.UsageLimit, v.UsageCount,
        v.IsActive, v.CreatedAt, v.UpdatedAt);
}
