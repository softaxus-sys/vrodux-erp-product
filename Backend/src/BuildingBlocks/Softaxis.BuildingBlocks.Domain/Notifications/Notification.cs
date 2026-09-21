namespace Softaxis.BuildingBlocks.Domain.Notifications;

/// <summary>
/// One alert for one user, from any module — the platform-wide successor to CRM's own notification
/// table (whose rows are copied in on first start; see NotificationBackfill).
///
/// <para>One row per recipient rather than one row plus a per-user read table: read state, and the
/// unread count that drives the bell, are the things read on every poll and every push, and keeping
/// them on the row itself makes that a single indexed scan instead of a join. The cost is duplicated
/// title/message text on a fan-out, which is a few hundred bytes.</para>
///
/// <para>Tenant-isolated via the shared shadow TenantId column. A row raised from a context with no
/// ambient tenant (background job, anonymous webhook) MUST have its tenant stamped explicitly by the
/// caller, or it is invisible to the very person it was raised for.</para>
/// </summary>
public sealed class Notification
{
    private Notification() { }

    public Notification(Guid userId, string module, string @event, string type, string title,
        string message, string? link, string? relatedToType, Guid? relatedToId)
    {
        Id            = Guid.NewGuid();
        UserId        = userId;
        Module        = Clip(module, 40) ?? "system";
        Event         = Clip(@event, 60) ?? "unknown";
        Type          = Clip(type, 30) ?? "info";
        Title         = Clip(title, 200) ?? string.Empty;
        Message       = Clip(message, 1000) ?? string.Empty;
        Link          = Clip(link, 500);
        RelatedToType = Clip(relatedToType, 40);
        RelatedToId   = relatedToId;
        CreatedAt     = DateTime.UtcNow;
    }

    public Guid      Id            { get; private set; }
    public Guid      UserId        { get; private set; }
    /// <summary>Module key — drives panel styling and the "can this reader still open it" gate.</summary>
    public string    Module        { get; private set; } = "system";
    /// <summary>Stable dotted event key, e.g. "lead.assigned". Never reworded once shipped.</summary>
    public string    Event         { get; private set; } = "unknown";
    /// <summary>info | success | warning | error | mention.</summary>
    public string    Type          { get; private set; } = "info";
    public string    Title         { get; private set; } = string.Empty;
    public string    Message       { get; private set; } = string.Empty;
    public string?   Link          { get; private set; }
    public string?   RelatedToType { get; private set; }
    public Guid?     RelatedToId   { get; private set; }
    public DateTime? ReadAt        { get; private set; }
    public DateTime  CreatedAt     { get; private set; }

    /// <summary>Idempotent — re-reading an already-read alert keeps the original timestamp.</summary>
    public void MarkRead() => ReadAt ??= DateTime.UtcNow;

    private static string? Clip(string? s, int max)
    {
        if (string.IsNullOrWhiteSpace(s)) return null;
        var t = s.Trim();
        return t.Length > max ? t[..max] : t;
    }
}
