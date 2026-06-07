using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.MasterData.PaymentTerms.Commands;

public sealed record UpsertPaymentTermCommand(
    Guid?   Id,
    string  Name,
    string  Code,
    int     DaysNet,
    decimal AdvancePercent,
    string? Description,
    bool    IsDefault
) : ICommand<PaymentTermDto>;

public sealed class UpsertPaymentTermCommandHandler(IPaymentTermRepository repo, IUnitOfWork uow)
    : ICommandHandler<UpsertPaymentTermCommand, PaymentTermDto>
{
    public async Task<Result<PaymentTermDto>> Handle(UpsertPaymentTermCommand cmd, CancellationToken ct)
    {
        if (await repo.CodeExistsAsync(cmd.Code, cmd.Id, ct))
            return Result.Failure<PaymentTermDto>(
                Error.Custom("PaymentTerm.CodeTaken", $"Payment term code '{cmd.Code}' is already in use."));

        PaymentTerm term;

        if (cmd.Id is null)
        {
            var result = PaymentTerm.Create(cmd.Name, cmd.Code, cmd.DaysNet,
                cmd.AdvancePercent, cmd.Description, cmd.IsDefault);
            if (result.IsFailure) return Result.Failure<PaymentTermDto>(result.Error);
            term = result.Value;
            term.CreatedAt = DateTime.UtcNow;
            term.CreatedBy = "system";
            repo.Add(term);
        }
        else
        {
            term = await repo.GetByIdAsync(cmd.Id.Value, ct)
                ?? throw new InvalidOperationException($"PaymentTerm {cmd.Id} not found.");
            term.Update(cmd.Name, cmd.Code, cmd.DaysNet, cmd.AdvancePercent, cmd.Description, cmd.IsDefault);
        }

        await uow.SaveChangesAsync(ct);

        return Result.Success(new PaymentTermDto(
            term.Id, term.Name, term.Code, term.DaysNet, term.AdvancePercent,
            term.Description, term.IsDefault, term.IsSystem,
            term.CreatedAt, term.UpdatedAt));
    }
}
