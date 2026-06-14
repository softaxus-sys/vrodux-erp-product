using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.RealEstate.Application.Tenants.Dtos;

namespace Softaxis.RealEstate.Application.Tenants.Queries;

public sealed record GetTenantsQuery : IQuery<IReadOnlyList<TenantDto>>;

public sealed record GetTenantsSummaryQuery : IQuery<TenantsSummaryDto>;
