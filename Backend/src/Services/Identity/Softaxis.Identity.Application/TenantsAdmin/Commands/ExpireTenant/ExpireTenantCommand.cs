using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Identity.Application.DTOs;

namespace Softaxis.Identity.Application.TenantsAdmin.Commands.ExpireTenant;

public sealed record ExpireTenantCommand(Guid Id) : ICommand<TenantDto>;
