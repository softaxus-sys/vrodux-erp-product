using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Identity.Application.DTOs;

namespace Softaxis.Identity.Application.TenantsAdmin.Commands.SetTenantModules;

public sealed record SetTenantModulesCommand(Guid Id, IReadOnlyList<string>? Modules) : ICommand<TenantDto>;
