using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.Vendors.Queries.GetVendorById;

public sealed class GetVendorByIdQueryHandler(IVendorRepository vendorRepo)
    : IQueryHandler<GetVendorByIdQuery, VendorDto>
{
    public async Task<Result<VendorDto>> Handle(GetVendorByIdQuery query, CancellationToken ct)
    {
        var v = await vendorRepo.GetByIdAsync(query.Id, ct);
        if (v is null) return Result.Failure<VendorDto>(Error.NotFoundById("Vendor", query.Id));

        return Result.Success(new VendorDto(
            v.Id, v.Name, v.Code, v.Category, v.ContactPerson,
            v.Email, v.Phone, v.Address, v.TaxNumber,
            v.PaymentTerms, v.Currency, v.Notes, v.Status, v.Rating,
            v.PurchaseOrders.Count,
            v.CreatedAt, v.UpdatedAt));
    }
}
