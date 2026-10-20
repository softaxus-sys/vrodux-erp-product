namespace Softaxis.Library.Domain.Entities;

/// <summary>
/// One row per workspace: whether members are emailed, and when. Off until the library turns it
/// on — a deployment must never start emailing a library's members by itself.
/// </summary>
public sealed class ReminderSettings
{
    private ReminderSettings() { }

    public ReminderSettings(string timeZoneId)
    {
        Id         = Guid.NewGuid();
        TimeZoneId = timeZoneId;
    }

    public Guid      Id                  { get; private set; }
    public bool      Enabled             { get; private set; }
    /// <summary>Days before the due date a "due soon" notice goes out. 0 = none.</summary>
    public int       DueSoonDays         { get; private set; } = 2;
    /// <summary>Days between overdue notices for the same loan. 0 = none.</summary>
    public int       OverdueEveryDays    { get; private set; } = 7;
    /// <summary>How many overdue notices one loan gets before the library takes over by hand.</summary>
    public int       OverdueMaxReminders { get; private set; } = 3;
    /// <summary>Email the member when a reserved copy is set aside for them.</summary>
    public bool      NotifyReady         { get; private set; } = true;
    /// <summary>Name the emails are signed with. Blank = "The Library".</summary>
    public string?   LibraryName         { get; private set; }
    /// <summary>Decides what "today" is for due dates. The server clock is UTC.</summary>
    public string    TimeZoneId          { get; private set; } = null!;
    /// <summary>Local date the daily due / overdue pass last ran, so it runs once a day.</summary>
    public string?   LastDailyRunOn      { get; private set; }
    public DateTime  CreatedAt           { get; private set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt           { get; private set; }

    public void Update(bool enabled, int dueSoonDays, int overdueEveryDays, int overdueMaxReminders,
        bool notifyReady, string? libraryName, string timeZoneId)
    {
        Enabled             = enabled;
        DueSoonDays         = dueSoonDays;
        OverdueEveryDays    = overdueEveryDays;
        OverdueMaxReminders = overdueMaxReminders;
        NotifyReady         = notifyReady;
        LibraryName         = Text.OrNull(libraryName);
        TimeZoneId          = timeZoneId;
        UpdatedAt           = DateTime.UtcNow;
    }

    public void MarkDailyRun(string localDate) => LastDailyRunOn = localDate;
}

public static class ReminderKind
{
    public const string DueSoon = "due_soon";
    public const string Overdue = "overdue";
    public const string Ready   = "ready";
}

public static class ReminderStatus
{
    /// <summary>Claimed, email not yet confirmed. Left like this only if the process died mid-send.</summary>
    public const string Pending = "pending";
    public const string Sent    = "sent";
    public const string Failed  = "failed";
}

/// <summary>
/// One notice about one loan or reservation. <see cref="Key"/> is unique per workspace, which is
/// what stops the same notice going out twice: the row is written before the email is sent.
/// </summary>
public sealed class ReminderLog
{
    private ReminderLog() { }

    public ReminderLog(string kind, string key, Guid memberId, string memberName, Guid? loanId,
        Guid? reservationId, string toEmail, string title)
    {
        Id            = Guid.NewGuid();
        Kind          = kind;
        Key           = key;
        MemberId      = memberId;
        MemberName    = memberName;
        LoanId        = loanId;
        ReservationId = reservationId;
        ToEmail       = toEmail;
        Title         = title;
    }

    public Guid     Id            { get; private set; }
    public string   Kind          { get; private set; } = null!;
    public string   Key           { get; private set; } = null!;
    public Guid     MemberId      { get; private set; }
    public string   MemberName    { get; private set; } = null!;
    public Guid?    LoanId        { get; private set; }
    public Guid?    ReservationId { get; private set; }
    public string   ToEmail       { get; private set; } = null!;
    /// <summary>The book the notice was about, as it was named at the time.</summary>
    public string   Title         { get; private set; } = null!;
    public string   Status        { get; private set; } = ReminderStatus.Pending;
    public string?  Error         { get; private set; }
    public DateTime CreatedAt     { get; private set; } = DateTime.UtcNow;

    public void MarkSent() => Status = ReminderStatus.Sent;

    /// <summary>
    /// Records the failure and gives the key back, so the same notice can be tried again later
    /// while this row stays in the log as evidence of the attempt.
    /// </summary>
    public void MarkFailed(string error)
    {
        Status = ReminderStatus.Failed;
        Error  = error.Length > 500 ? error[..500] : error;
        Key    = $"{Key}:failed:{Id:N}";
    }
}
