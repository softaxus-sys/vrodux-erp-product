using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.MasterData.TaxRates.Commands;

public sealed record DeleteTaxRateCommand(Guid Id) : ICommand;

public sealed class DeleteTaxRateCommandHandler(ITaxRateRepository repo, IUnitOfWork uow)
    : ICommandHandler<DeleteTaxRateCommand>
{
    public async Task<Result> Handle(DeleteTaxRateCommand cmd, CancellationToken ct)
    {
        var item = await repo.GetByIdAsync(cmd.Id, ct);
        if (item is null) return Result.Failure(Error.NotFoundById("TaxRate", cmd.Id));
        if (item.IsSystem) return Result.Failure(Error.Custom("TaxRate.CannotDeleteSystem",
            "System tax rates cannot be deleted. Deactivate them instead."));
        item.IsDeleted = true;
        item.DeletedAt = DateTime.UtcNow;
        await uow.SaveChangesAsync(ct);
        return Result.Success();
    }
}
