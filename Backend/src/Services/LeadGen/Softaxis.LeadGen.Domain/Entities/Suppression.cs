namespace Softaxis.LeadGen.Domain.Entities;

/// <summary>
/// Someone this workspace must never contact again — unsubscribed, bounced, complained, or marked
/// do-not-contact. Checked before every send and before a prospect is queued into a campaign.
/// </summary>
public sealed class SuppressionEntry
{
    private SuppressionEntry() { }

    public SuppressionEntry(string kind, string value, string reason, string? source, Guid? userId)
    {
        Id = Guid.NewGuid(); Kind = kind; Value = Normalize(kind, value); Reason = reason;
        Source = Text.OrNull(source); CreatedByUserId = userId;
    }

    public Guid     Id              { get; private set; }
    public string   Kind            { get; private set; } = SuppressionKind.Email;
    public string   Value           { get; private set; } = null!;
    public string   Reason          { get; private set; } = SuppressionReason.Manual;
    public string?  Source          { get; private set; }
    public Guid?    CreatedByUserId { get; private set; }
    public DateTime CreatedAt       { get; private set; } = DateTime.UtcNow;
    public bool     IsDeleted       { get; private set; }

    public void Delete() => IsDeleted = true;

    /// <summary>Emails and domains compare lower-case; phones compare as digits so "+971 50…" matches "0097150…".</summary>
    public static string Normalize(string kind, string value)
    {
        var v = value.Trim();
        if (kind == SuppressionKind.Phone)
        {
            var digits = new string(v.Where(char.IsDigit).ToArray());
            return digits.StartsWith("00") ? digits[2..] : digits;
        }
        v = v.ToLowerInvariant();
        return kind == SuppressionKind.Domain ? v.TrimStart('@') : v;
    }
}
