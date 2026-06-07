using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.Vendors.Queries.GetVendors;

public sealed class GetVendorsQueryHandler(IVendorRepository vendorRepo)
    : IQueryHandler<GetVendorsQuery, PagedResult<VendorDto>>
{
    public async Task<Result<PagedResult<VendorDto>>> Handle(GetVendorsQuery query, CancellationToken ct)
    {
        var paged = await vendorRepo.GetPagedAsync(
            query.Page, query.PageSize,
            query.Search, query.Status, query.Category, ct);

        var dtos = paged.Items.Select(v => new VendorDto(
            v.Id, v.Name, v.Code, v.Category, v.ContactPerson,
            v.Email, v.Phone, v.Address, v.TaxNumber,
            v.PaymentTerms, v.Currency, v.Notes, v.Status, v.Rating,
            v.PurchaseOrders.Count,
            v.CreatedAt, v.UpdatedAt)).ToList();

        return Result.Success(PagedResult<VendorDto>.Create(dtos, paged.TotalCount, paged.Page, paged.PageSize));
    }
}
