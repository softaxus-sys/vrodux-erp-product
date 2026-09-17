namespace Softaxis.Support.Application.Options;

/// <summary>
/// Bound from the "Support" config section. <see cref="OperatorTenantId"/> is the tenant id of
/// Softaxis's own workspace — the ONE tenant whose users may act as support agents. Left unset
/// until that tenant is created and its id is copied in; every agent-side check fails closed
/// while it is unset (see <c>SupportAccessGuard</c>), never defaults open.
/// </summary>
public sealed class SupportOptions
{
    public const string SectionName = "Support";

    public Guid? OperatorTenantId { get; set; }
}
