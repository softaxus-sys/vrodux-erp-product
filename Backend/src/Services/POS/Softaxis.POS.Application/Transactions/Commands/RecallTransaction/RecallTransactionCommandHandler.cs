using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.Transactions.Commands.RecallTransaction;

public sealed class RecallTransactionCommandHandler(
    IHeldTransactionRepository heldRepo,
    IUnitOfWork                uow)
    : ICommandHandler<RecallTransactionCommand, HeldTransactionDto>
{
    public async Task<Result<HeldTransactionDto>> Handle(RecallTransactionCommand cmd, CancellationToken ct)
    {
        var held = await heldRepo.GetByIdAsync(cmd.HeldTransactionId, ct);
        if (held is null)
            return Result.Failure<HeldTransactionDto>(Error.NotFoundById("HeldTransaction", cmd.HeldTransactionId));

        if (held.IsRecalled)
            return Result.Failure<HeldTransactionDto>(Error.Custom("Hold.AlreadyRecalled", "This transaction has already been recalled."));

        held.Recall();
        heldRepo.Update(held);
        await uow.SaveChangesAsync(ct);

        return Result.Success(new HeldTransactionDto(
            held.Id, held.SessionId, held.Label,
            held.ItemsJson, held.CustomerId, held.HeldAt));
    }
}
