namespace Softaxis.BuildingBlocks.Application.Multitenancy;

/// <summary>
/// Decides whether a background job should act on a given workspace.
///
/// <para>
/// Every hosted service runs in every deployment of the gateway. Where the same workspace exists in
/// two deployments - an on-premises installation and its cloud mirror - an unfiltered job runs twice
/// over the same tenant. The clearest example is recurring invoicing: both copies generate the same
/// workspace's invoices, with clashing document numbers, and the cloud's copies are then overwritten
/// by the next sync push. Nothing reports it, and it surfaces at month end.
/// </para>
///
/// <para>
/// Call this once per workspace in any hosted service that loops over tenants. It exists as a shared
/// abstraction rather than a repeated <c>if</c> so the next hosted service inherits the rule instead
/// of rediscovering it. See <c>docs/on-premises-cloud-mirror.md</c> §8.2.
/// </para>
/// </summary>
public interface ITenantWorkFilter
{
    /// <summary>
    /// False when this deployment must not run tenant-scoped background work for the workspace -
    /// today, when it is a read-only cloud mirror and the work belongs to the shop.
    /// </summary>
    Task<bool> ShouldProcessAsync(Guid tenantId, CancellationToken ct = default);
}

/// <summary>
/// Default for hosts with no mirror concept - standalone service hosts and design-time tooling.
/// Processes everything, which is the behaviour every job had before the filter existed.
/// </summary>
public sealed class AllowAllTenantWorkFilter : ITenantWorkFilter
{
    public Task<bool> ShouldProcessAsync(Guid tenantId, CancellationToken ct = default) =>
        Task.FromResult(true);
}
