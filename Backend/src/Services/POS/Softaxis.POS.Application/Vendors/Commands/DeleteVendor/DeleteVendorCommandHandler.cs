using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.Vendors.Commands.DeleteVendor;

public sealed class DeleteVendorCommandHandler(
    IVendorRepository vendorRepo,
    IUnitOfWork       uow)
    : ICommandHandler<DeleteVendorCommand>
{
    public async Task<Result> Handle(DeleteVendorCommand cmd, CancellationToken ct)
    {
        var vendor = await vendorRepo.GetByIdAsync(cmd.Id, ct);
        if (vendor is null) return Result.Failure(Error.NotFoundById("Vendor", cmd.Id));

        vendor.Delete();
        await uow.SaveChangesAsync(ct);
        return Result.Success();
    }
}
