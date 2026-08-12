namespace Softaxis.Identity.Domain.Enums;

/// <summary>
/// Lifecycle state of a tenant. Persisted as a <b>string</b> (see <c>TenantConfiguration</c>),
/// so member names are load-bearing — renaming one silently re-interprets existing rows.
/// </summary>
public enum TenantStatus
{
    /// <summary>Free trial running. <c>TrialEndsAt</c> is set.</summary>
    Trial     = 1,

    /// <summary>Paid, or activated by a super admin. Full access.</summary>
    Active    = 2,

    /// <summary>Access revoked by an administrator. Data retained.</summary>
    Suspended = 3,

    /// <summary>Trial or subscription lapsed. Access gated, data retained.</summary>
    Expired   = 4,

    /// <summary>
    /// Signed up via a "Buy Now" link and has not paid yet — deliberately <b>not</b> on a trial.
    /// <para>
    /// Distinct from <see cref="Expired"/> so the UI can say "complete your purchase" to a brand-new
    /// account instead of the alarming "your access has ended". Access is gated to the billing page
    /// exactly like the other blocked states; the tenant can pay, or start a trial from there.
    /// </para>
    /// </summary>
    PendingPayment = 5,
}
