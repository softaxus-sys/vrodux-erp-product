using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.Abstractions;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.Transactions.Commands.HoldTransaction;

public sealed class HoldTransactionCommandHandler(
    IPOSSessionRepository       sessionRepo,
    IHeldTransactionRepository  heldRepo,
    ICurrentUser                currentUser,
    IUnitOfWork                 uow)
    : ICommandHandler<HoldTransactionCommand, HeldTransactionDto>
{
    public async Task<Result<HeldTransactionDto>> Handle(HoldTransactionCommand cmd, CancellationToken ct)
    {
        var session = await sessionRepo.GetByIdAsync(cmd.SessionId, ct);
        if (session is null)
            return Result.Failure<HeldTransactionDto>(Error.NotFoundById("Session", cmd.SessionId));

        if (session.Status != Domain.Enums.SessionStatus.Open)
            return Result.Failure<HeldTransactionDto>(Error.Custom("Session.NotOpen", "Session is not open."));

        var result = HeldTransaction.Create(
            cmd.SessionId, currentUser.Id ?? session.CashierId,
            cmd.Label, cmd.ItemsJson, cmd.CustomerId);

        if (result.IsFailure)
            return Result.Failure<HeldTransactionDto>(result.Error);

        heldRepo.Add(result.Value);
        await uow.SaveChangesAsync(ct);

        return Result.Success(new HeldTransactionDto(
            result.Value.Id, result.Value.SessionId, result.Value.Label,
            result.Value.ItemsJson, result.Value.CustomerId, result.Value.HeldAt));
    }
}
