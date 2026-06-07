using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.SalesQuotations.Commands.DeleteSalesQuotation;

public sealed class DeleteSalesQuotationCommandHandler(
    ISalesQuotationRepository sqRepo,
    IUnitOfWork               uow)
    : ICommandHandler<DeleteSalesQuotationCommand>
{
    public async Task<Result> Handle(DeleteSalesQuotationCommand cmd, CancellationToken ct)
    {
        var sq = await sqRepo.GetByIdAsync(cmd.Id, ct);
        if (sq is null) return Result.Failure(Error.NotFoundById("SalesQuotation", cmd.Id));

        sq.Delete();
        await uow.SaveChangesAsync(ct);
        return Result.Success();
    }
}
