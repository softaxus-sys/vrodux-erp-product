namespace Softaxis.POS.Domain.Entities;

/// <summary>
/// One row per workspace: whether customers are emailed about money they owe, and how often.
/// Off until the shop switches it on, because a deploy must never start emailing a shop's customers.
/// </summary>
public sealed class CreditReminderSettings
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public bool Enabled { get; private set; }
    /// <summary>Remind when a payment falls due within this many days. 0 = no reminder before the due date.</summary>
    public int DaysBeforeDue { get; private set; } = 3;
    /// <summary>First overdue reminder goes out this many days after the due date.</summary>
    public int OverdueAfterDays { get; private set; } = 1;
    public int RepeatEveryDays { get; private set; } = 7;
    /// <summary>Most overdue reminders sent for one stretch of lateness.</summary>
    public int MaxOverdueReminders { get; private set; } = 3;
    /// <summary>The name the email comes from (the shop's own name).</summary>
    public string SenderName { get; private set; } = "";
    /// <summary>A copy of every reminder goes here, if set.</summary>
    public string? CcEmail { get; private set; }
    public string TimeZoneId { get; private set; } = "Asia/Dubai";
    public string? LastDailyRunOn { get; private set; }

    public void Update(bool enabled, int daysBeforeDue, int overdueAfterDays, int repeatEveryDays, int maxOverdue,
        string senderName, string? ccEmail, string timeZoneId)
    {
        Enabled = enabled; DaysBeforeDue = daysBeforeDue; OverdueAfterDays = overdueAfterDays;
        RepeatEveryDays = repeatEveryDays; MaxOverdueReminders = maxOverdue;
        SenderName = senderName.Trim(); CcEmail = string.IsNullOrWhiteSpace(ccEmail) ? null : ccEmail.Trim();
        TimeZoneId = timeZoneId;
    }

    public void MarkDailyRun(string day) => LastDailyRunOn = day;
}

/// <summary>An email sent (or tried) to a customer about what they owe. The unique Key is the guard
/// against sending the same reminder twice.</summary>
public sealed class CreditReminderLog
{
    private CreditReminderLog() { }

    public CreditReminderLog(Guid customerId, string customerName, string email, string kind, decimal amount, string? key)
    {
        CustomerId = customerId; CustomerName = customerName; Email = email; Kind = kind; Amount = amount;
        Key = key; Status = "pending"; CreatedAt = DateTime.UtcNow;
    }

    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid CustomerId { get; private set; }
    public string CustomerName { get; private set; } = "";
    public string Email { get; private set; } = "";
    /// <summary>due_soon | overdue | manual</summary>
    public string Kind { get; private set; } = "";
    public decimal Amount { get; private set; }
    public string? Key { get; private set; }
    /// <summary>pending | sent | failed</summary>
    public string Status { get; private set; } = "pending";
    public string? Error { get; private set; }
    public DateTime CreatedAt { get; private set; }

    public void MarkSent() { Status = "sent"; Error = null; }

    /// <summary>A failed send gives its key back so a later pass can try again.</summary>
    public void MarkFailed(string error) { Status = "failed"; Error = error.Length > 300 ? error[..300] : error; Key = null; }
}
