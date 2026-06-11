using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Identity.Application.DTOs;

namespace Softaxis.Identity.Application.TenantsAdmin.Queries.GetTenantById;

public sealed record GetTenantByIdQuery(Guid Id) : IQuery<TenantDto>;
