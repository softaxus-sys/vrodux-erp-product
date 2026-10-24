using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Identity.Application.DTOs;

namespace Softaxis.Identity.Application.TenantsAdmin.Commands.SetTenantMirror;

/// <summary>Turns the read-only cloud-mirror flag on or off for a workspace (super admin only).</summary>
public sealed record SetTenantMirrorCommand(Guid Id, bool IsMirror) : ICommand<TenantDto>;
