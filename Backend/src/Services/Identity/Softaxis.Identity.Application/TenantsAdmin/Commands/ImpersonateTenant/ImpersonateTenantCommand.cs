using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Identity.Application.TenantsAdmin.Commands.ImpersonateTenant;

/// <summary>
/// Super-admin only. Issues a short-lived access token scoped to <paramref name="TenantId"/> so the
/// super-admin can view/operate the app AS that tenant (data scoped to the tenant, that tenant's
/// modules), instead of seeing every tenant's records pooled together.
/// </summary>
public sealed record ImpersonateTenantCommand(Guid TenantId, Guid SuperAdminUserId)
    : ICommand<ImpersonationResultDto>;

/// <summary>The tenant-scoped token plus enough context for the UI to show a "viewing as" banner.</summary>
public sealed record ImpersonationResultDto(
    string AccessToken,
    Guid   TenantId,
    string TenantName,
    string TenantSlug);
