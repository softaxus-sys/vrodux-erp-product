using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.POS.Application.DTOs;

namespace Softaxis.POS.Application.Vendors.Queries.GetVendors;

public sealed record GetVendorsQuery(
    string? Search,
    string? Status,
    string? Category,
    int     Page,
    int     PageSize)
    : IQuery<PagedResult<VendorDto>>;
