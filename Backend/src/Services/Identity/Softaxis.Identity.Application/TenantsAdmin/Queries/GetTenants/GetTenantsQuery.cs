using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Identity.Application.DTOs;

namespace Softaxis.Identity.Application.TenantsAdmin.Queries.GetTenants;

public sealed record GetTenantsQuery : IQuery<IReadOnlyList<TenantDto>>;
