using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Identity.Application.DTOs;

namespace Softaxis.Identity.Application.TenantsAdmin.Queries.GetTenantUserCount;

public sealed record GetTenantUserCountQuery(Guid Id) : IQuery<TenantUserCountDto>;
