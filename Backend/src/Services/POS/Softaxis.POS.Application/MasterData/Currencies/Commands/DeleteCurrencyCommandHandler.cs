using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.MasterData.Currencies.Commands;

public sealed record DeleteCurrencyCommand(Guid Id) : ICommand;

public sealed class DeleteCurrencyCommandHandler(ICurrencyRepository repo, IUnitOfWork uow)
    : ICommandHandler<DeleteCurrencyCommand>
{
    public async Task<Result> Handle(DeleteCurrencyCommand cmd, CancellationToken ct)
    {
        var item = await repo.GetByIdAsync(cmd.Id, ct);
        if (item is null)
            return Result.Failure(Error.NotFoundById("Currency", cmd.Id));
        if (item.IsSystem)
            return Result.Failure(Error.Custom("Currency.CannotDeleteSystem",
                "System currencies cannot be deleted. Deactivate them instead."));

        item.IsDeleted = true;
        item.DeletedAt = DateTime.UtcNow;
        await uow.SaveChangesAsync(ct);
        return Result.Success();
    }
}
