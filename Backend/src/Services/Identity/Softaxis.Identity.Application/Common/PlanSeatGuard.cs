using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.Common;

/// <summary>
/// The plan's seat limit, checked in one place.
///
/// <para>Every path that mints a login has to apply it. HR provisioning a login for an employee
/// did not, so a tenant could walk straight past a limit that Settings → Users enforced — the same
/// rule, two implementations, and only one of them present.</para>
///
/// <para>Linking an <b>existing</b> login to an employee deliberately does not come through here:
/// that account already exists and is already counted, so it consumes no additional seat.</para>
/// </summary>
public static class PlanSeatGuard
{
    /// <returns>The error to return, or null when another user may be created.</returns>
    public static async Task<Error?> CheckAsync(
        IUserRepository userRepo,
        ICurrentUser    currentUser,
        ITenantContext  tenantContext,
        CancellationToken ct = default)
    {
        // Super admins operate above any single tenant's plan, and an unresolved tenant has no
        // plan to measure against. MaxUsers <= 0 means unlimited.
        if (currentUser.IsSuperAdmin
            || !tenantContext.IsResolved
            || !tenantContext.TenantId.HasValue
            || tenantContext.Limits is not { MaxUsers: > 0 } limits)
            return null;

        var count = await userRepo.CountByTenantAsync(tenantContext.TenantId.Value, ct);
        if (count < limits.MaxUsers) return null;

        return Error.Custom(
            "Plan.UserLimitReached",
            $"Your {tenantContext.Plan} plan allows a maximum of {limits.MaxUsers} users. " +
            "Please upgrade to add more users.");
    }
}
