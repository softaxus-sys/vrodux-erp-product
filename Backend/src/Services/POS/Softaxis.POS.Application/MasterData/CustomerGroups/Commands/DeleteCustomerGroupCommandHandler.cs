using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.MasterData.CustomerGroups.Commands;

public sealed record DeleteCustomerGroupCommand(Guid Id) : ICommand;

public sealed class DeleteCustomerGroupCommandHandler(ICustomerGroupRepository repo, IUnitOfWork uow)
    : ICommandHandler<DeleteCustomerGroupCommand>
{
    public async Task<Result> Handle(DeleteCustomerGroupCommand cmd, CancellationToken ct)
    {
        var item = await repo.GetByIdAsync(cmd.Id, ct);
        if (item is null) return Result.Failure(Error.NotFoundById("CustomerGroup", cmd.Id));
        if (item.IsSystem) return Result.Failure(Error.Custom("CustomerGroup.CannotDeleteSystem",
            "System customer groups cannot be deleted. Deactivate them instead."));
        item.IsDeleted = true;
        item.DeletedAt = DateTime.UtcNow;
        await uow.SaveChangesAsync(ct);
        return Result.Success();
    }
}
