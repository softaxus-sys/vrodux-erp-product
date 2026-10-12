namespace Softaxis.Identity.Domain.Entities;

/// <summary>
/// The free trial is exactly <see cref="DurationDays"/> days — one number, defined once.
///
/// <see cref="Tenant.StartTrial"/> takes no length on purpose: every path that grants a trial
/// (self-serve signup, super-admin tenant creation, claiming a trial from the billing page) gets
/// the same period, and none of them can pass a different one. The web app mirrors this value as
/// <c>TRIAL_DAYS</c> in <c>lib/billing/plans.ts</c> for the labels — change both together.
/// </summary>
public static class TrialPolicy
{
    public const int DurationDays = 14;
}
