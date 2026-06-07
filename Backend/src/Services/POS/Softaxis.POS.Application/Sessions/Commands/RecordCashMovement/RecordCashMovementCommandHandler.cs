using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.Abstractions;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Enums;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.Sessions.Commands.RecordCashMovement;

public sealed class RecordCashMovementCommandHandler(
    IPOSSessionRepository   sessionRepo,
    ICashMovementRepository movementRepo,
    ICurrentUser            currentUser,
    IUnitOfWork             uow)
    : ICommandHandler<RecordCashMovementCommand, CashMovementDto>
{
    public async Task<Result<CashMovementDto>> Handle(RecordCashMovementCommand cmd, CancellationToken ct)
    {
        var session = await sessionRepo.GetByIdAsync(cmd.SessionId, ct);
        if (session is null)
            return Result.Failure<CashMovementDto>(Error.NotFoundById("Session", cmd.SessionId));

        if (session.Status != SessionStatus.Open)
            return Result.Failure<CashMovementDto>(Error.Custom("Session.NotOpen",
                "Cash movements can only be recorded in an open session."));

        var cashierId = currentUser.Id ?? session.CashierId;
        var isPayIn   = cmd.Type == "payin";
        var type      = isPayIn ? CashMovementType.PayIn : CashMovementType.PayOut;

        var createResult = CashMovement.Create(cmd.SessionId, cashierId, type, cmd.Amount, cmd.Reason);
        if (createResult.IsFailure)
            return Result.Failure<CashMovementDto>(createResult.Error);
        var movement = createResult.Value;
        movement.CreatedAt = DateTime.UtcNow;
        movement.CreatedBy = currentUser.Username ?? "system";

        var adjust = session.RecordCashMovement(cmd.Amount, isPayIn);
        if (adjust.IsFailure)
            return Result.Failure<CashMovementDto>(adjust.Error);

        movementRepo.Add(movement);
        sessionRepo.Update(session);
        await uow.SaveChangesAsync(ct);

        return Result.Success(new CashMovementDto(
            movement.Id, movement.SessionId, movement.CashierId,
            movement.Type.ToString(), movement.Amount, movement.Reason, movement.CreatedAt));
    }
}
