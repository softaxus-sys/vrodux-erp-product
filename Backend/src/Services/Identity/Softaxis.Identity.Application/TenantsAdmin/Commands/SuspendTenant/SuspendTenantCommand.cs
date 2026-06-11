using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Identity.Application.DTOs;

namespace Softaxis.Identity.Application.TenantsAdmin.Commands.SuspendTenant;

public sealed record SuspendTenantCommand(Guid Id) : ICommand<TenantDto>;
