using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.MasterData.PaymentTerms.Commands;

public sealed record DeletePaymentTermCommand(Guid Id) : ICommand;

public sealed class DeletePaymentTermCommandHandler(IPaymentTermRepository repo, IUnitOfWork uow)
    : ICommandHandler<DeletePaymentTermCommand>
{
    public async Task<Result> Handle(DeletePaymentTermCommand cmd, CancellationToken ct)
    {
        var item = await repo.GetByIdAsync(cmd.Id, ct);
        if (item is null) return Result.Failure(Error.NotFoundById("PaymentTerm", cmd.Id));
        if (item.IsSystem) return Result.Failure(Error.Custom("PaymentTerm.CannotDeleteSystem",
            "System payment terms cannot be deleted. Contact your administrator."));
        item.IsDeleted = true;
        item.DeletedAt = DateTime.UtcNow;
        await uow.SaveChangesAsync(ct);
        return Result.Success();
    }
}
