using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Identity.Application.TenantsAdmin.Commands.DeleteTenant;

public sealed record DeleteTenantCommand(Guid Id) : ICommand;
