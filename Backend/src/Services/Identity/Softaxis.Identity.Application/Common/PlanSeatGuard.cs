using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Domain.Entities;
using Softaxis.Identity.Domain.Enums;
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
///
/// <para><b>A free trial has no seat limit.</b> The signup page promises unlimited users while
/// trying the product, and an invited team is the strongest reason to subscribe when it ends — so
/// the limit only starts to apply once the tenant is no longer on a trial. The size they grew to is
/// then checked when they choose a plan (see <see cref="PlanFit"/>), so nobody can buy a tier
/// smaller than the team they already have.</para>
/// </summary>
public static class PlanSeatGuard
{
    /// <returns>The error to return, or null when another user may be created.</returns>
    public static async Task<Error?> CheckAsync(
        IUserRepository   userRepo,
        ITenantRepository tenantRepo,
        ICurrentUser      currentUser,
        ITenantContext    tenantContext,
        CancellationToken ct = default)
    {
        // Super admins operate above any single tenant's plan, and an unresolved tenant has no
        // plan to measure against. MaxUsers <= 0 means unlimited.
        if (currentUser.IsSuperAdmin
            || !tenantContext.IsResolved
            || !tenantContext.TenantId.HasValue
            || tenantContext.Limits is not { MaxUsers: > 0 } limits)
            return null;

        var tenantId = tenantContext.TenantId.Value;

        // Read the status from the database, not the token: a trial that has just ended must start
        // enforcing straight away, not whenever the user's token next refreshes.
        var tenant = await tenantRepo.GetByIdAsync(tenantId, ct);
        if (tenant is { Status: TenantStatus.Trial }) return null;

        var count = await userRepo.CountSeatsAsync(tenantId, ct);
        if (count < limits.MaxUsers) return null;

        return Error.Custom(
            "Plan.UserLimitReached",
            $"Your {tenantContext.Plan} plan allows a maximum of {limits.MaxUsers} users and you have {count}. " +
            "Upgrade your plan, or deactivate a user, to add another.");
    }
}

/// <summary>
/// Whether a tier is big enough for the team a tenant already has. Used at checkout so a team that
/// grew during the trial cannot buy a plan too small for it — which, because seats are only checked
/// when a user is created, would otherwise let them keep every existing user on the cheapest tier.
/// </summary>
public static class PlanFit
{
    /// <summary>The smallest self-serve tier that holds <paramref name="seats"/>, or null if none does.</summary>
    public static PlanType? SmallestFitting(int seats)
    {
        foreach (var plan in PlanDefinitions.SelfServePlans
                     .OrderBy(p => PlanDefinitions.Get(p).MaxUsers))
        {
            var max = PlanDefinitions.Get(plan).MaxUsers;
            if (max < 0 || seats <= max) return plan;
        }
        return null;
    }

    /// <returns>An error describing what to do instead, or null when <paramref name="plan"/> fits.</returns>
    public static Error? Check(PlanType plan, int seats)
    {
        var max = PlanDefinitions.Get(plan).MaxUsers;
        if (max < 0 || seats <= max) return null;

        if (SmallestFitting(seats) is { } fit)
            return Error.Custom(
                "Billing.PlanTooSmall",
                $"You have {seats} active users. Pick the {PlanDefinitions.Get(fit).MaxUsers}-user tier ({fit}), " +
                "or deactivate users first.");

        return Error.Custom(
            "Billing.PlanTooSmall",
            $"You have {seats} active users, which is more than the largest self-serve plan " +
            $"({PlanDefinitions.SelfServePlans.Max(p => PlanDefinitions.Get(p).MaxUsers)} users). " +
            "Contact our sales team about Enterprise, or deactivate users first.");
    }
}
