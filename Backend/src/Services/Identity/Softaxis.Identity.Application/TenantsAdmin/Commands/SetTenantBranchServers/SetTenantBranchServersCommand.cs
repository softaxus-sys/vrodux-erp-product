using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Identity.Application.DTOs;

namespace Softaxis.Identity.Application.TenantsAdmin.Commands.SetTenantBranchServers;

/// <summary>Turns "cloud + continuous operations" (branch servers) on or off for a workspace (super admin only).</summary>
public sealed record SetTenantBranchServersCommand(Guid Id, bool Enabled) : ICommand<TenantDto>;
