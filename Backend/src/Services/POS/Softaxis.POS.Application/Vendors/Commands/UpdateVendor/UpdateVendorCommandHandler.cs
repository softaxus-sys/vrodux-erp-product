using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.Vendors.Commands.UpdateVendor;

public sealed class UpdateVendorCommandHandler(
    IVendorRepository vendorRepo,
    IUnitOfWork       uow)
    : ICommandHandler<UpdateVendorCommand>
{
    public async Task<Result> Handle(UpdateVendorCommand cmd, CancellationToken ct)
    {
        var vendor = await vendorRepo.GetByIdAsync(cmd.Id, ct);
        if (vendor is null) return Result.Failure(Error.NotFoundById("Vendor", cmd.Id));

        vendor.Update(
            cmd.Name, cmd.Code, cmd.Category, cmd.ContactPerson,
            cmd.Email, cmd.Phone, cmd.Address, cmd.TaxNumber,
            cmd.PaymentTerms, cmd.Currency, cmd.Notes,
            cmd.Status ?? vendor.Status,
            cmd.Rating  ?? vendor.Rating);

        await uow.SaveChangesAsync(ct);
        return Result.Success();
    }
}
