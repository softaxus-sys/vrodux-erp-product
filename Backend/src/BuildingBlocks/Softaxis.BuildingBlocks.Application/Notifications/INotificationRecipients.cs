namespace Softaxis.BuildingBlocks.Application.Notifications;

/// <summary>
/// Answers "who should be told" for alerts that belong to a QUEUE rather than to one named person.
///
/// <para>Assignment alerts have an obvious recipient — the new owner. Approval alerts do not: a leave
/// request, a purchase requisition or a payroll awaiting sign-off is addressed to whoever holds the
/// permission to action it, which is a different set of people in every workspace. Resolving that
/// needs a cross-schema read of Identity, and four modules writing their own copy of that query is
/// four chances to get the tenant filter or the bracketing wrong.</para>
/// </summary>
public interface INotificationRecipients
{
    /// <summary>
    /// Everyone in <paramref name="tenantId"/> whose ROLES grant <paramref name="permissionKey"/>
    /// (e.g. "hr.leaves.approve"), capped so a large workspace is never spammed.
    ///
    /// <para>Role-derived only: per-user grants and denies (the override system) are not applied, the
    /// same scope as the other cross-schema recipient lookups in this codebase. The consequence is
    /// narrow — someone granted the permission individually may miss the alert and see it in the queue
    /// instead — and it keeps this to one indexed join rather than a per-user computation.</para>
    /// </summary>
    Task<IReadOnlyList<Guid>> WithPermissionAsync(Guid tenantId, string permissionKey, CancellationToken ct = default);
}
