namespace Softaxis.AiAssistant.Domain.Entities;

/// <summary>
/// One outbound AI voice call to a CRM lead. Created when a <c>crm.lead.created</c> event lands
/// (voice agent enabled + lead has a phone), placed by the background worker when due, and
/// finalized by the Vapi end-of-call webhook (transcript, recording, outcome). The lead's CRM
/// status is updated from here via the run-as user's permissions. Tenant-isolated.
/// </summary>
public sealed class ScheduledCall
{
    // EF ctor
    private ScheduledCall() { }

    public ScheduledCall(Guid leadId, string leadName, string phone, string language, DateTime dueAt, string? leadContext)
    {
        Id          = Guid.NewGuid();
        LeadId      = leadId;
        LeadName    = leadName;
        Phone       = phone;
        Language    = language;
        DueAt       = dueAt;
        LeadContext = leadContext;
        Status      = "pending";
    }

    public Guid   Id       { get; private set; }
    public Guid   LeadId   { get; private set; }
    public string LeadName { get; private set; } = "";
    /// <summary>E.164-ish phone as stored on the lead (normalized best-effort before dialing).</summary>
    public string Phone    { get; private set; } = null!;
    /// <summary>"en" | "ur" | "ar" — M1 always "en"; M2 routes by country code.</summary>
    public string Language { get; private set; } = "en";

    /// <summary>Compact JSON with the lead's form context (company, source, city…) for the call prompt.</summary>
    public string? LeadContext { get; private set; }

    /// <summary>"pending" | "dialing" | "in_progress" | "completed" | "no_answer" | "failed" | "canceled".</summary>
    public string Status { get; private set; } = "pending";

    public int      AttemptCount { get; private set; }
    public DateTime DueAt        { get; private set; }

    /// <summary>The Vapi call id of the latest attempt — how webhook events find this row.</summary>
    public string? VapiCallId { get; private set; }

    // ── Outcome (from the end-of-call report) ─────────────────────────────────
    public string? EndedReason     { get; private set; }
    public int     DurationSeconds { get; private set; }
    public string? TranscriptText  { get; private set; }
    public string? RecordingUrl    { get; private set; }
    public string? Summary         { get; private set; }
    public string? Error           { get; private set; }

    /// <summary>True once the lead's CRM status/note was written after the call.</summary>
    public bool LeadUpdated { get; private set; }

    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    public ICollection<CallAttempt> Attempts { get; private set; } = new List<CallAttempt>();

    public CallAttempt StartAttempt(string vapiCallId)
    {
        AttemptCount++;
        VapiCallId = vapiCallId;
        Status     = "dialing";
        Error      = null;
        var attempt = new CallAttempt(Id, AttemptCount, vapiCallId);
        Attempts.Add(attempt);
        return attempt;
    }

    public void MarkInProgress() => Status = "in_progress";

    /// <summary>Finalize from the end-of-call report. <paramref name="status"/> is the mapped
    /// outcome: "completed" | "no_answer" | "failed".</summary>
    public void RecordOutcome(
        string status, string? endedReason, int durationSeconds,
        string? transcript, string? recordingUrl, string? summary)
    {
        Status          = status;
        EndedReason     = Truncate(endedReason, 200);
        DurationSeconds = Math.Max(0, durationSeconds);
        TranscriptText  = transcript;
        RecordingUrl    = Truncate(recordingUrl, 1000);
        Summary         = summary;
    }

    /// <summary>Re-queue for another attempt (retry machine — M2).</summary>
    public void Reschedule(DateTime dueAt)
    {
        Status = "pending";
        DueAt  = dueAt;
    }

    public void Cancel(string reason)
    {
        Status = "canceled";
        Error  = Truncate(reason, 1000);
    }

    public void Fail(string error)
    {
        Status = "failed";
        Error  = Truncate(error, 1000);
    }

    public void MarkLeadUpdated() => LeadUpdated = true;

    private static string? Truncate(string? s, int max) =>
        string.IsNullOrEmpty(s) ? s : s.Length <= max ? s : s[..max];
}

/// <summary>One dial attempt of a <see cref="ScheduledCall"/> (audit trail for the retry machine).</summary>
public sealed class CallAttempt
{
    // EF ctor
    private CallAttempt() { }

    public CallAttempt(Guid scheduledCallId, int attemptNumber, string vapiCallId)
    {
        Id              = Guid.NewGuid();
        ScheduledCallId = scheduledCallId;
        AttemptNumber   = attemptNumber;
        VapiCallId      = vapiCallId;
        StartedAt       = DateTime.UtcNow;
    }

    public Guid   Id              { get; private set; }
    public Guid   ScheduledCallId { get; private set; }
    public int    AttemptNumber   { get; private set; }
    public string VapiCallId      { get; private set; } = null!;

    public DateTime  StartedAt { get; private set; }
    public DateTime? EndedAt   { get; private set; }

    /// <summary>"completed" | "no_answer" | "failed" — null while the call is live.</summary>
    public string? Outcome         { get; private set; }
    public int     DurationSeconds { get; private set; }
    public string? Error           { get; private set; }

    public DateTime CreatedAt { get; private set; }

    public void Complete(string outcome, int durationSeconds, string? error)
    {
        Outcome         = outcome;
        DurationSeconds = Math.Max(0, durationSeconds);
        Error           = string.IsNullOrEmpty(error) ? null : error.Length <= 1000 ? error : error[..1000];
        EndedAt         = DateTime.UtcNow;
    }
}
