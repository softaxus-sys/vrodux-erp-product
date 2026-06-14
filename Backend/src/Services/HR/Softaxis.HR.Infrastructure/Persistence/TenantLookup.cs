namespace Softaxis.HR.Infrastructure.Persistence;

/// <summary>
/// Read-only projection of <c>identity.tenants</c> (owned by the Identity service, but
/// shares the same physical database). Used to resolve a public careers-portal tenant
/// slug to a TenantId without a cross-service call. Never written to from HR.
/// </summary>
public sealed class TenantLookup
{
    public Guid   Id     { get; private set; }
    public string Slug   { get; private set; } = string.Empty;
    public string Name   { get; private set; } = string.Empty;
    public string Status { get; private set; } = string.Empty;
}
