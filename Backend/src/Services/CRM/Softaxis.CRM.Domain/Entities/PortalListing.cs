namespace Softaxis.CRM.Domain.Entities;

/// <summary>
/// A property-portal listing an agent has registered as theirs — the routing key for portal leads.
///
/// <para>Why this exists: a Bayut WhatsApp push names the enquirer and the listing and NOTHING about
/// the agent (Bayut confirmed agent details appear only on agent-profile leads). The listing is the
/// one value that ties the enquiry back to whoever published it, so the agent records it here when
/// they publish, and every later enquiry on that listing reaches them directly.</para>
///
/// <para>Two keys, because a push carries both and they live in different namespaces: the account's
/// <see cref="Reference"/> ("100104-SI9UFU") and the numeric <see cref="ListingId"/> inside the
/// listing URL ("/pm/15476575/…"). Keying on only one is how a registration that looks correct
/// silently matches nothing.</para>
///
/// Auto tenant-isolated (lives in Softaxis.CRM.Domain → shadow TenantId + global filter).
/// </summary>
public sealed class PortalListing
{
    private PortalListing() { }

    public PortalListing(string portal, string? reference, string? listingId, string? url, string? title,
        Guid agentUserId, string agentName, Guid? teamId, Guid? createdByUserId)
    {
        Id              = Guid.NewGuid();
        Portal          = portal;
        CreatedByUserId = createdByUserId;
        IsActive        = true;
        CreatedAt       = DateTime.UtcNow;
        Update(reference, listingId, url, title, agentUserId, agentName, teamId, true);
    }

    public Guid      Id              { get; private set; }
    /// <summary>Provider key of the portal: <c>bayut</c>, <c>property-finder</c>, <c>dubizzle</c>.</summary>
    public string    Portal          { get; private set; } = "bayut";
    public string?   Reference       { get; private set; }
    public string?   ListingId       { get; private set; }
    public string?   Url             { get; private set; }
    public string?   Title           { get; private set; }
    public Guid      AgentUserId     { get; private set; }
    public string    AgentName       { get; private set; } = string.Empty;
    public Guid?     TeamId          { get; private set; }
    /// <summary>An inactive listing stays on record (sold, withdrawn) but no longer routes enquiries.</summary>
    public bool      IsActive        { get; private set; }
    public int       EnquiryCount    { get; private set; }
    public DateTime? LastEnquiryAt   { get; private set; }
    public Guid?     CreatedByUserId { get; private set; }
    public bool      IsDeleted       { get; private set; }
    public DateTime  CreatedAt       { get; private set; }
    public DateTime? UpdatedAt       { get; private set; }

    public void Update(string? reference, string? listingId, string? url, string? title,
        Guid agentUserId, string agentName, Guid? teamId, bool isActive)
    {
        Reference   = Clip(reference, 60);
        ListingId   = Clip(listingId, 20);
        Url         = Clip(url, 500);
        Title       = Clip(title, 200);
        AgentUserId = agentUserId;
        AgentName   = Clip(agentName, 200) ?? string.Empty;
        TeamId      = teamId;
        IsActive    = isActive;
        UpdatedAt   = DateTime.UtcNow;
    }

    /// <summary>Called when a portal enquiry was routed through this listing, so the agent can see it working.</summary>
    public void RecordEnquiry()
    {
        EnquiryCount++;
        LastEnquiryAt = DateTime.UtcNow;
    }

    public void Delete()
    {
        IsDeleted = true;
        IsActive  = false;
        UpdatedAt = DateTime.UtcNow;
    }

    private static string? Clip(string? s, int max)
    {
        if (string.IsNullOrWhiteSpace(s)) return null;
        var t = s.Trim();
        return t.Length > max ? t[..max] : t;
    }
}
