using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Identity.Application.DTOs;

namespace Softaxis.Identity.Application.TenantsAdmin.Commands.ActivateTenant;

public sealed record ActivateTenantCommand(Guid Id) : ICommand<TenantDto>;
