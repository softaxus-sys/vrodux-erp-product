namespace Softaxis.CRM.Domain.Entities;

/// <summary>
/// One alert for one user — today "a lead just arrived for you", raised by the intake pipeline.
///
/// <para>Why this exists: portals such as Bayut stopped messaging agents directly and now deliver
/// leads only to the CRM webhook, so without an alert here a new enquiry sits unseen. One row per
/// recipient, so read-state is per person.</para>
///
/// Auto tenant-isolated (lives in Softaxis.CRM.Domain → shadow TenantId + global filter). Rows created
/// from anonymous webhook contexts must have their TenantId stamped explicitly by the caller.
/// </summary>
public sealed class CrmNotification
{
    private CrmNotification() { }

    public CrmNotification(Guid userId, string type, string title, string message,
        string? link, string? relatedToType, Guid? relatedToId)
    {
        Id            = Guid.NewGuid();
        UserId        = userId;
        Type          = Clip(type, 30) ?? "info";
        Title         = Clip(title, 200) ?? string.Empty;
        Message       = Clip(message, 1000) ?? string.Empty;
        Link          = Clip(link, 500);
        RelatedToType = Clip(relatedToType, 30);
        RelatedToId   = relatedToId;
        CreatedAt     = DateTime.UtcNow;
    }

    public Guid      Id            { get; private set; }
    public Guid      UserId        { get; private set; }
    /// <summary>Panel styling bucket: info | success | warning | error | mention.</summary>
    public string    Type          { get; private set; } = "info";
    public string    Title         { get; private set; } = string.Empty;
    public string    Message       { get; private set; } = string.Empty;
    /// <summary>App-relative path the alert opens, e.g. <c>/crm/leads?lead={id}</c>.</summary>
    public string?   Link          { get; private set; }
    public string?   RelatedToType { get; private set; }
    public Guid?     RelatedToId   { get; private set; }
    public DateTime? ReadAt        { get; private set; }
    public DateTime  CreatedAt     { get; private set; }

    public void MarkRead() => ReadAt ??= DateTime.UtcNow;

    private static string? Clip(string? s, int max)
    {
        if (string.IsNullOrWhiteSpace(s)) return null;
        var t = s.Trim();
        return t.Length > max ? t[..max] : t;
    }
}
