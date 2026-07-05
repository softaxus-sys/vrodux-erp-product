namespace Softaxis.CRM.Domain.Entities;

/// <summary>
/// Join between a Deal (opportunity) and a Contact, carrying the contact's role
/// on that specific deal (decision_maker / champion / influencer / user / blocker /
/// other). Replaces the single free-text <c>Deal.ContactJson</c> blob so an
/// opportunity can have many contacts with distinct buying roles. Hard-deleted on
/// unlink (it's a pure association row).
/// </summary>
public sealed class DealContact
{
    private DealContact() { }

    public DealContact(Guid dealId, Guid contactId, string role)
    {
        Id        = Guid.NewGuid();
        DealId    = dealId;
        ContactId = contactId;
        Role      = string.IsNullOrWhiteSpace(role) ? "other" : role.Trim();
        CreatedAt = DateTime.UtcNow;
    }

    public Guid      Id        { get; private set; }
    public Guid      DealId    { get; private set; }
    public Guid      ContactId { get; private set; }
    public string    Role      { get; private set; } = "other";
    public DateTime  CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }

    public void SetRole(string role)
    {
        Role = string.IsNullOrWhiteSpace(role) ? "other" : role.Trim();
        UpdatedAt = DateTime.UtcNow;
    }
}
