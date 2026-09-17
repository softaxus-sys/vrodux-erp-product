namespace Softaxis.RealEstate.Infrastructure.Persistence;

/// <summary>
/// Read-only projection of <c>identity.tenants</c> (owned by the Identity service, but sharing the
/// same physical database). Resolves a public website's tenant slug to a TenantId without a
/// cross-service call. Never written to from Real Estate.
/// </summary>
public sealed class TenantLookup
{
    public Guid   Id     { get; private set; }
    public string Slug   { get; private set; } = string.Empty;
    public string Name   { get; private set; } = string.Empty;
    public string Status { get; private set; } = string.Empty;
}
