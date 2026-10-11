namespace Softaxis.Library.Infrastructure.Persistence;

/// <summary>The few columns of identity.tenants the member portal needs. Never written.</summary>
public sealed class TenantLookup
{
    public Guid    Id        { get; private set; }
    public string  Slug      { get; private set; } = null!;
    public string  Name      { get; private set; } = null!;
    public string  Status    { get; private set; } = null!;
    public string? Currency  { get; private set; }
    public bool    IsDeleted { get; private set; }
}
