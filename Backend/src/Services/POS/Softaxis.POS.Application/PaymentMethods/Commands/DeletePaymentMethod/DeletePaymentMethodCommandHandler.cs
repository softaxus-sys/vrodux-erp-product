using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.PaymentMethods.Commands.DeletePaymentMethod;

public sealed class DeletePaymentMethodCommandHandler(
    IPaymentMethodConfigRepository repo,
    IUnitOfWork uow)
    : ICommandHandler<DeletePaymentMethodCommand>
{
    public async Task<Result> Handle(DeletePaymentMethodCommand cmd, CancellationToken ct)
    {
        var method = await repo.GetByIdAsync(cmd.Id, ct);
        if (method is null)
            return Result.Failure(Error.NotFoundById("PaymentMethod", cmd.Id));

        if (method.IsSystem)
            return Result.Failure(Error.Custom(
                "PaymentMethod.CannotDeleteSystem",
                "System payment methods cannot be deleted. Disable them instead."));

        // Soft-delete via AuditableEntity
        method.IsDeleted = true;
        method.DeletedAt = DateTime.UtcNow;
        method.SetEnabled(false);

        await uow.SaveChangesAsync(ct);
        return Result.Success();
    }
}
