namespace Softaxis.LeadGen.Domain.Entities;

public static class SearchStatus
{
    public const string Queued = "queued", Running = "running", Completed = "completed",
        Failed = "failed", Cancelled = "cancelled";

    public static readonly string[] All = [Queued, Running, Completed, Failed, Cancelled];
}

public static class ProspectStatus
{
    /// <summary>Found by a search. Contact details are held back until it is revealed.</summary>
    public const string Discovered = "discovered";
    public const string Revealed = "revealed", Contacted = "contacted", Replied = "replied",
        Qualified = "qualified", Converted = "converted", Rejected = "rejected",
        DoNotContact = "do_not_contact";

    public static readonly string[] All =
        [Discovered, Revealed, Contacted, Replied, Qualified, Converted, Rejected, DoNotContact];

    /// <summary>Statuses a person may set by hand. The rest are set by the system.</summary>
    public static readonly string[] Manual = [Revealed, Qualified, Rejected, DoNotContact, Contacted, Replied];
}

/// <summary>
/// How far an email address has been checked. Only <see cref="Valid"/> is a promise; <see cref="Likely"/>
/// means the domain can receive mail and the address is well-formed but no provider confirmed the mailbox.
/// </summary>
public static class EmailStatus
{
    public const string Unknown = "unknown", Valid = "valid", Likely = "likely", Risky = "risky",
        Invalid = "invalid", Disposable = "disposable";

    /// <summary>Addresses that are safe to send cold email to.</summary>
    public static bool Sendable(string? s) => s is Valid or Likely;
}

public static class LedgerType
{
    public const string Grant = "grant", Purchase = "purchase", Spend = "spend", Refund = "refund",
        Adjustment = "adjustment";
}

public static class SuppressionKind
{
    public const string Email = "email", Domain = "domain", Phone = "phone";
    public static readonly string[] All = [Email, Domain, Phone];
}

public static class SuppressionReason
{
    public const string Unsubscribed = "unsubscribed", Bounced = "bounced", Complaint = "complaint",
        Manual = "manual", DoNotContact = "do_not_contact", Negative = "negative_reply";
}

public static class PurchaseStatus
{
    public const string Pending = "pending", Paid = "paid", Failed = "failed", Expired = "expired";
}

internal static class Text
{
    public static string? OrNull(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    /// <summary>Lower-case, letters and digits only. Two spellings of a business name collapse to one key.</summary>
    public static string Key(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return string.Empty;
        var sb = new System.Text.StringBuilder(s.Length);
        foreach (var c in s) if (char.IsLetterOrDigit(c)) sb.Append(char.ToLowerInvariant(c));
        return sb.ToString();
    }
}
