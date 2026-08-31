namespace Softaxis.RealEstate.Domain.Entities;

/// <summary>
/// One row per workspace controlling rent and expiry reminders. Seeded on FIRST READ, never at
/// startup: the startup seed runs with no ambient tenant, so a row written there lands with a
/// NULL tenant column and is then invisible to the very workspace it was meant for.
/// </summary>
public sealed class RentAlertSettings
{
    public Guid Id { get; private set; } = Guid.NewGuid();

    public bool Enabled { get; private set; } = true;

    /// <summary>Comma-separated days BEFORE the due date to remind, e.g. "30,7,1".</summary>
    public string DueReminderDaysBefore { get; private set; } = "30,7,1";

    /// <summary>Once a payment is late, remind again every N days.</summary>
    public int OverdueRepeatDays { get; private set; } = 3;

    /// <summary>Cap on overdue chasers per installment. Without one, a tenant who never pays is
    /// mailed forever and the workspace ends up on spam lists.</summary>
    public int OverdueMaxReminders { get; private set; } = 6;

    /// <summary>Comma-separated days before contract end, e.g. "90,60,30".</summary>
    public string ExpiryReminderDaysBefore { get; private set; } = "90,60,30";

    /// <summary>Comma-separated addresses copied on every alert (property manager, accounts).</summary>
    public string? CcEmails { get; private set; }

    /// <summary>Copy every user holding a real-estate permission. Off by default deliberately —
    /// a workspace's user list includes HR-only staff and self-service employees who have no
    /// business seeing a tenant's arrears.</summary>
    public bool CcAllRealEstateUsers { get; private set; }

    /// <summary>Which clock decides that today is the due date. Rent falling due "today" in Dubai
    /// is still yesterday in UTC for four hours — Module 43 hit exactly this with attendance, so
    /// the zone is stored rather than assumed.</summary>
    public string TimeZoneId { get; private set; } = "Asia/Dubai";

    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; private set; } = DateTime.UtcNow;

    public void Update(bool enabled, string dueDaysBefore, int overdueRepeatDays, int overdueMaxReminders,
        string expiryDaysBefore, string? ccEmails, bool ccAllRealEstateUsers, string? timeZoneId)
    {
        Enabled = enabled;
        DueReminderDaysBefore = Normalize(dueDaysBefore, "30,7,1");
        OverdueRepeatDays = Math.Max(1, overdueRepeatDays);
        OverdueMaxReminders = Math.Max(0, overdueMaxReminders);
        ExpiryReminderDaysBefore = Normalize(expiryDaysBefore, "90,60,30");
        CcEmails = string.IsNullOrWhiteSpace(ccEmails) ? null : ccEmails.Trim();
        CcAllRealEstateUsers = ccAllRealEstateUsers;
        if (!string.IsNullOrWhiteSpace(timeZoneId)) TimeZoneId = timeZoneId.Trim();
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Local date in the workspace's zone. An unresolvable id falls back to UTC rather
    /// than throwing — a bad zone id must not stop every reminder in the system.</summary>
    public string Today()
    {
        try
        {
            var tz = TimeZoneInfo.FindSystemTimeZoneById(TimeZoneId);
            return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz).ToString("yyyy-MM-dd");
        }
        catch
        {
            return DateTime.UtcNow.ToString("yyyy-MM-dd");
        }
    }

    public IReadOnlyList<int> DueOffsets    => ParseOffsets(DueReminderDaysBefore);
    public IReadOnlyList<int> ExpiryOffsets => ParseOffsets(ExpiryReminderDaysBefore);

    public IReadOnlyList<string> CcList =>
        (CcEmails ?? string.Empty)
            .Split([',', ';'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

    /// <summary>Descending so the widest lead time is evaluated first; de-duplicated so "7,7"
    /// cannot send the same reminder twice on the same day.</summary>
    private static List<int> ParseOffsets(string csv) =>
        (csv ?? string.Empty)
            .Split([',', ';'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(s => int.TryParse(s, out var n) ? n : -1)
            .Where(n => n >= 0)
            .Distinct()
            .OrderByDescending(n => n)
            .ToList();

    private static string Normalize(string csv, string fallback)
    {
        var parsed = ParseOffsets(csv);
        return parsed.Count == 0 ? fallback : string.Join(",", parsed);
    }
}
