using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.Vendors.Commands.CreateVendor;

public sealed class CreateVendorCommandHandler(
    IVendorRepository vendorRepo,
    IUnitOfWork       uow)
    : ICommandHandler<CreateVendorCommand, VendorDto>
{
    public async Task<Result<VendorDto>> Handle(CreateVendorCommand cmd, CancellationToken ct)
    {
        var vendor = new Vendor(
            cmd.Name, cmd.Code, cmd.Category, cmd.ContactPerson,
            cmd.Email, cmd.Phone, cmd.Address, cmd.TaxNumber,
            cmd.PaymentTerms, cmd.Currency, cmd.Notes);

        vendorRepo.Add(vendor);
        await uow.SaveChangesAsync(ct);

        return Result.Success(new VendorDto(
            vendor.Id, vendor.Name, vendor.Code, vendor.Category, vendor.ContactPerson,
            vendor.Email, vendor.Phone, vendor.Address, vendor.TaxNumber,
            vendor.PaymentTerms, vendor.Currency, vendor.Notes, vendor.Status, vendor.Rating,
            0, vendor.CreatedAt, vendor.UpdatedAt));
    }
}
