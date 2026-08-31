using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.RealEstate.Application.Tenants.Dtos;

namespace Softaxis.RealEstate.Application.Tenants.Queries;

// Search runs in SQL so the tenant picker on the lease form can ask for the few it needs rather
// than pulling every tenant to filter in the browser.
public sealed record GetTenantsQuery(
    string? Search   = null,
    string? Status   = null,
    string? TenantType = null,
    int     Page     = 1,
    int     PageSize = 30) : IQuery<PagedResult<TenantDto>>;

public sealed record GetTenantsSummaryQuery : IQuery<TenantsSummaryDto>;
