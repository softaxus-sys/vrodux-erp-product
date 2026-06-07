using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.MasterData.Vouchers.Commands;

public sealed record DeleteVoucherCommand(Guid Id) : ICommand;

public sealed class DeleteVoucherCommandHandler(IVoucherRepository repo, IUnitOfWork uow)
    : ICommandHandler<DeleteVoucherCommand>
{
    public async Task<Result> Handle(DeleteVoucherCommand cmd, CancellationToken ct)
    {
        var item = await repo.GetByIdAsync(cmd.Id, ct);
        if (item is null) return Result.Failure(Error.NotFoundById("Voucher", cmd.Id));
        item.IsDeleted = true;
        item.DeletedAt = DateTime.UtcNow;
        await uow.SaveChangesAsync(ct);
        return Result.Success();
    }
}
