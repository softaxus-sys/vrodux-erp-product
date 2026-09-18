namespace Softaxis.Support.Application.Abstractions;

/// <summary>
/// The one place that decides "is this caller allowed to act as a support agent" — belt and
/// suspenders on top of the `support.tickets.*` permission claim. A permission key alone is not
/// enough: nothing stops that key from being granted inside some OTHER tenant's role (nobody
/// would do it deliberately, but a mistake there must not open the cross-tenant ticket queue to
/// that tenant). This additionally requires the caller's own tenant to be the configured
/// support-operator tenant (Softaxis's own workspace), read from <c>Support:OperatorTenantId</c>.
/// Unconfigured = fails closed (nobody is treated as an agent) rather than defaulting open.
/// </summary>
public interface ISupportAccessGuard
{
    /// <summary>True only when the caller's own tenant is the configured operator tenant.
    /// Does NOT check the permission claim — callers combine this with <c>ICurrentUser.HasPermission</c>.</summary>
    bool IsOperatorTenantCaller { get; }
}
