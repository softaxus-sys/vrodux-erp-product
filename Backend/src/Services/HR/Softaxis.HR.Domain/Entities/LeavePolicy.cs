namespace Softaxis.HR.Domain.Entities;

/// <summary>
/// Per-tenant annual entitlement for one leave type. Balances are derived from this
/// (entitlement − days taken this year) rather than stored on the employee, so a policy
/// change applies immediately and nothing has to be recalculated in place.
/// </summary>
public sealed class LeavePolicy
{
    private LeavePolicy() { }

    public LeavePolicy(string leaveType, decimal annualEntitlementDays, bool isPaid, string? description)
    {
        Id                    = Guid.NewGuid();
        LeaveType             = leaveType.Trim().ToLowerInvariant();
        AnnualEntitlementDays = annualEntitlementDays;
        IsPaid                = isPaid;
        Description           = description?.Trim();
        CreatedAt             = DateTime.UtcNow;
    }

    public Guid     Id                    { get; private set; }
    public string   LeaveType             { get; private set; } = string.Empty;
    public decimal  AnnualEntitlementDays { get; private set; }
    public bool     IsPaid                { get; private set; } = true;
    public string?  Description           { get; private set; }
    public bool     IsActive              { get; private set; } = true;
    public DateTime CreatedAt             { get; private set; }
    public DateTime? UpdatedAt            { get; private set; }
    public bool     IsDeleted             { get; private set; }

    public void Update(decimal annualEntitlementDays, bool isPaid, string? description, bool isActive)
    {
        AnnualEntitlementDays = annualEntitlementDays;
        IsPaid                = isPaid;
        Description           = description?.Trim();
        IsActive              = isActive;
        UpdatedAt             = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; IsActive = false; UpdatedAt = DateTime.UtcNow; }
}
