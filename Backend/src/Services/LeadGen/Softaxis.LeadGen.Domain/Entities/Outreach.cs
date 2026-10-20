namespace Softaxis.LeadGen.Domain.Entities;

public static class MailboxProvider
{
    public const string Google = "google", Microsoft = "microsoft", Imap = "imap";
    public static readonly string[] All = [Google, Microsoft, Imap];
}

public static class MailboxStatus
{
    public const string Connected = "connected", Error = "error", Paused = "paused", Disconnected = "disconnected";
}

public static class CampaignStatus
{
    public const string Draft = "draft", Active = "active", Paused = "paused", Completed = "completed", Stopped = "stopped";
}

public static class RecipientStatus
{
    public const string Pending = "pending", Active = "active", Completed = "completed", Replied = "replied",
        Bounced = "bounced", Unsubscribed = "unsubscribed", Stopped = "stopped", Failed = "failed", Skipped = "skipped";

    public static bool IsOpen(string s) => s is Pending or Active;
}

public static class MessageDirection { public const string Out = "out", In = "in"; }

public static class MessageStatus
{
    public const string Queued = "queued", Sent = "sent", Failed = "failed", Bounced = "bounced", Received = "received";
}

public static class ThreadClass
{
    public const string None = "none", Interested = "interested", NotInterested = "not_interested",
        OutOfOffice = "out_of_office", Unsubscribe = "unsubscribe", Bounce = "bounce", Question = "question";

    public static readonly string[] All = [None, Interested, NotInterested, OutOfOffice, Unsubscribe, Bounce, Question];
}

/// <summary>How many emails a new mailbox may send per day, rising as it builds a sending history.</summary>
public static class Warmup
{
    public static int DailyLimit(DateTime? startedAtUtc, DateTime nowUtc, int ceiling)
    {
        if (startedAtUtc is null) return Math.Min(10, ceiling);
        var day = Math.Max(0, (int)(nowUtc.Date - startedAtUtc.Value.Date).TotalDays);
        var ramp = day switch { < 7 => 10, < 14 => 20, < 21 => 30, < 28 => 40, _ => int.MaxValue };
        return Math.Min(ramp, ceiling);
    }
}

/// <summary>When a send is allowed: inside the campaign's local hours, on its working days.</summary>
public static class SendSchedule
{
    public static TimeZoneInfo Zone(string? id)
    {
        if (string.IsNullOrWhiteSpace(id)) return TimeZoneInfo.Utc;
        try { return TimeZoneInfo.FindSystemTimeZoneById(id); } catch { return TimeZoneInfo.Utc; }
    }

    public static bool IsValidZone(string? id)
    {
        if (string.IsNullOrWhiteSpace(id)) return false;
        try { TimeZoneInfo.FindSystemTimeZoneById(id); return true; } catch { return false; }
    }

    public static bool TryParseTime(string? s, out TimeSpan t) => TimeSpan.TryParseExact(s, @"hh\:mm", null, out t);

    /// <summary>ISO weekday numbers 1 (Mon) – 7 (Sun) from "1,2,3,4,5".</summary>
    public static HashSet<int> ParseDays(string? days)
    {
        var set = new HashSet<int>();
        foreach (var p in (days ?? "1,2,3,4,5").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            if (int.TryParse(p, out var d) && d is >= 1 and <= 7) set.Add(d);
        return set.Count == 0 ? [1, 2, 3, 4, 5] : set;
    }

    static int Iso(DayOfWeek d) => d == DayOfWeek.Sunday ? 7 : (int)d;

    /// <summary>
    /// The earliest moment at or after <paramref name="fromUtc"/> that falls inside the sending window.
    /// Returns the same instant when it already does.
    /// </summary>
    public static DateTime NextSlot(DateTime fromUtc, string? zoneId, string start, string end, string? days)
    {
        var zone = Zone(zoneId);
        if (!TryParseTime(start, out var s)) s = TimeSpan.FromHours(9);
        if (!TryParseTime(end, out var e)) e = TimeSpan.FromHours(17);
        if (e <= s) e = s.Add(TimeSpan.FromHours(1));
        var allowed = ParseDays(days);

        var local = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(fromUtc, DateTimeKind.Utc), zone);
        for (var i = 0; i < 15; i++)
        {
            var day = local.Date.AddDays(i);
            if (!allowed.Contains(Iso(day.DayOfWeek))) continue;
            var open = day + s; var close = day + e;
            DateTime candidate;
            if (i == 0)
            {
                if (local >= close) continue;
                candidate = local < open ? open : local;
            }
            else candidate = open;
            return TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(candidate, DateTimeKind.Unspecified), zone);
        }
        return fromUtc.AddDays(1);
    }

    /// <summary>True when <paramref name="utc"/> is inside the window right now.</summary>
    public static bool IsOpen(DateTime utc, string? zoneId, string start, string end, string? days)
        => NextSlot(utc, zoneId, start, end, days) <= utc.AddSeconds(1);
}

/// <summary>
/// An email account a workspace sends from and reads replies in. Credentials are encrypted before
/// they reach this class and are never returned by the API.
/// </summary>
public sealed class Mailbox
{
    private Mailbox() { }

    public Mailbox(Guid ownerUserId, string provider, string address, string? displayName)
    {
        Id = Guid.NewGuid(); OwnerUserId = ownerUserId; Provider = provider;
        Address = address.Trim().ToLowerInvariant(); DisplayName = Text.OrNull(displayName);
    }

    public Guid      Id           { get; private set; }
    public Guid      OwnerUserId  { get; private set; }
    public string    Provider     { get; private set; } = MailboxProvider.Imap;
    public string    Address      { get; private set; } = null!;
    public string?   DisplayName  { get; private set; }
    public string    Status       { get; private set; } = MailboxStatus.Disconnected;
    public string?   StatusReason { get; private set; }

    /// <summary>Encrypted JSON: OAuth tokens, or the SMTP/IMAP password.</summary>
    public string?   Credentials  { get; private set; }
    public string?   SmtpHost     { get; private set; }
    public int?      SmtpPort     { get; private set; }
    public string?   ImapHost     { get; private set; }
    public int?      ImapPort     { get; private set; }
    public string?   Username     { get; private set; }

    /// <summary>Per-mailbox ceiling chosen by the workspace; the platform ceiling and warm-up still apply.</summary>
    public int       DailyLimit   { get; private set; } = 40;
    public DateTime? WarmupStartedAt { get; private set; }
    public int       SentToday    { get; private set; }
    public DateOnly? SentTodayDate { get; private set; }
    public DateTime? LastSentAt   { get; private set; }

    public string?   SyncCursor   { get; private set; }
    public DateTime? LastSyncAt   { get; private set; }
    public string?   LastError    { get; private set; }

    public int       TotalSent       { get; private set; }
    public int       TotalBounced    { get; private set; }
    public int       TotalComplaints { get; private set; }
    public int       TotalReplies    { get; private set; }

    public string?   SignatureText { get; private set; }
    public DateTime  CreatedAt    { get; private set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt    { get; private set; }
    public bool      IsDeleted    { get; private set; }

    public bool CanSend => Status == MailboxStatus.Connected;

    public void SetCredentials(string protectedJson) { Credentials = protectedJson; UpdatedAt = DateTime.UtcNow; }

    public void SetServers(string? smtpHost, int? smtpPort, string? imapHost, int? imapPort, string? username)
    { SmtpHost = Text.OrNull(smtpHost); SmtpPort = smtpPort; ImapHost = Text.OrNull(imapHost); ImapPort = imapPort; Username = Text.OrNull(username); }

    public void MarkConnected()
    {
        Status = MailboxStatus.Connected; StatusReason = null; LastError = null;
        WarmupStartedAt ??= DateTime.UtcNow; UpdatedAt = DateTime.UtcNow;
    }

    public void MarkError(string error)
    {
        Status = MailboxStatus.Error; LastError = error.Length > 400 ? error[..400] : error; UpdatedAt = DateTime.UtcNow;
    }

    public void Pause(string reason) { Status = MailboxStatus.Paused; StatusReason = reason; UpdatedAt = DateTime.UtcNow; }
    public void Resume() { if (Status == MailboxStatus.Paused) { Status = MailboxStatus.Connected; StatusReason = null; UpdatedAt = DateTime.UtcNow; } }
    public void Disconnect() { Status = MailboxStatus.Disconnected; Credentials = null; SyncCursor = null; UpdatedAt = DateTime.UtcNow; }

    public void SetLimits(int dailyLimit, string? signature, string? displayName)
    { DailyLimit = dailyLimit; SignatureText = Text.OrNull(signature); DisplayName = Text.OrNull(displayName); UpdatedAt = DateTime.UtcNow; }

    public void SetSyncCursor(string? cursor) { SyncCursor = cursor; LastSyncAt = DateTime.UtcNow; LastError = Status == MailboxStatus.Error ? LastError : null; }

    /// <summary>How many more this mailbox may send today, given the platform ceiling.</summary>
    public int RemainingToday(DateTime nowUtc, int platformCeiling)
    {
        var today = DateOnly.FromDateTime(nowUtc);
        var sent = SentTodayDate == today ? SentToday : 0;
        var limit = Math.Min(DailyLimit, Warmup.DailyLimit(WarmupStartedAt, nowUtc, platformCeiling));
        return Math.Max(0, limit - sent);
    }

    public void RecordSent(DateTime nowUtc)
    {
        var today = DateOnly.FromDateTime(nowUtc);
        if (SentTodayDate != today) { SentTodayDate = today; SentToday = 0; }
        SentToday++; TotalSent++; LastSentAt = nowUtc;
    }

    public void RecordBounce() => TotalBounced++;
    public void RecordComplaint() => TotalComplaints++;
    public void RecordReply() => TotalReplies++;
    public void Delete() { IsDeleted = true; Status = MailboxStatus.Disconnected; Credentials = null; UpdatedAt = DateTime.UtcNow; }
}

/// <summary>A sequence of emails sent to a list of prospects from one mailbox.</summary>
public sealed class Campaign
{
    private Campaign() { }

    public Campaign(string name, Guid mailboxId, Guid? userId, string? userName)
    {
        Id = Guid.NewGuid(); Name = name.Trim(); MailboxId = mailboxId; CreatedByUserId = userId; CreatedByName = userName;
    }

    public Guid      Id          { get; private set; }
    public string    Name        { get; private set; } = null!;
    public Guid      MailboxId   { get; private set; }
    public string    Status      { get; private set; } = CampaignStatus.Draft;
    public string    TimeZoneId  { get; private set; } = "Asia/Dubai";
    public string    WindowStart { get; private set; } = "09:00";
    public string    WindowEnd   { get; private set; } = "17:00";
    /// <summary>ISO weekday numbers, comma separated. The UAE working week is Monday–Friday.</summary>
    public string    SendDays    { get; private set; } = "1,2,3,4,5";
    public int       DailyCap    { get; private set; } = 40;
    public bool      StopOnReply { get; private set; } = true;
    public Guid?     CreatedByUserId { get; private set; }
    public string?   CreatedByName   { get; private set; }
    public DateTime  CreatedAt   { get; private set; } = DateTime.UtcNow;
    public DateTime? StartedAt   { get; private set; }
    public DateTime? UpdatedAt   { get; private set; }
    public string?   PauseReason { get; private set; }
    public bool      IsDeleted   { get; private set; }

    public List<CampaignStep> Steps { get; private set; } = [];

    public void Configure(string name, Guid mailboxId, string tz, string start, string end, string days, int dailyCap, bool stopOnReply)
    {
        Name = name.Trim(); MailboxId = mailboxId; TimeZoneId = tz; WindowStart = start; WindowEnd = end;
        SendDays = days; DailyCap = dailyCap; StopOnReply = stopOnReply; UpdatedAt = DateTime.UtcNow;
    }

    public void Start() { Status = CampaignStatus.Active; StartedAt ??= DateTime.UtcNow; PauseReason = null; UpdatedAt = DateTime.UtcNow; }
    public void Pause(string? reason = null) { if (Status == CampaignStatus.Active) { Status = CampaignStatus.Paused; PauseReason = reason; UpdatedAt = DateTime.UtcNow; } }
    public void Stop() { Status = CampaignStatus.Stopped; UpdatedAt = DateTime.UtcNow; }
    public void Complete() { Status = CampaignStatus.Completed; UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; Status = CampaignStatus.Stopped; UpdatedAt = DateTime.UtcNow; }
}

public sealed class CampaignStep
{
    private CampaignStep() { }

    public CampaignStep(Guid campaignId, int number, int delayDays, string subject, string body)
    {
        Id = Guid.NewGuid(); CampaignId = campaignId; Number = number; DelayDays = delayDays; Subject = subject; Body = body;
    }

    public Guid    Id         { get; private set; }
    public Guid    CampaignId { get; private set; }
    public int     Number     { get; private set; }
    /// <summary>Days to wait after the previous step. Ignored for step 1.</summary>
    public int     DelayDays  { get; private set; }
    public string  Subject    { get; private set; } = null!;
    /// <summary>Plain text with {{merge}} fields. Sent as text and as a minimal HTML copy.</summary>
    public string  Body       { get; private set; } = null!;

    public void Update(int delayDays, string subject, string body) { DelayDays = delayDays; Subject = subject; Body = body; }
}

/// <summary>One prospect's journey through a campaign.</summary>
public sealed class CampaignRecipient
{
    private CampaignRecipient() { }

    public CampaignRecipient(Guid campaignId, Guid prospectId, string email)
    {
        Id = Guid.NewGuid(); CampaignId = campaignId; ProspectId = prospectId; Email = email.Trim().ToLowerInvariant();
    }

    public Guid      Id          { get; private set; }
    public Guid      CampaignId  { get; private set; }
    public Guid      ProspectId  { get; private set; }
    public string    Email       { get; private set; } = null!;
    public string    Status      { get; private set; } = RecipientStatus.Pending;
    /// <summary>The last step that was sent; 0 = nothing sent yet.</summary>
    public int       CurrentStep { get; private set; }
    public DateTime? NextSendAt  { get; private set; }
    public DateTime? LastSentAt  { get; private set; }
    public Guid?     ThreadId    { get; private set; }
    public int       Attempts    { get; private set; }
    public string?   LastError   { get; private set; }
    public DateTime  CreatedAt   { get; private set; } = DateTime.UtcNow;

    public void Schedule(DateTime atUtc) { Status = RecipientStatus.Active; NextSendAt = atUtc; }

    public void RecordSent(Guid threadId, int step, DateTime nowUtc, DateTime? nextAtUtc)
    {
        CurrentStep = step; LastSentAt = nowUtc; ThreadId = threadId; Attempts = 0; LastError = null;
        if (nextAtUtc is null) { Status = RecipientStatus.Completed; NextSendAt = null; }
        else { Status = RecipientStatus.Active; NextSendAt = nextAtUtc; }
    }

    public void RecordFailure(string error, DateTime retryAtUtc, int maxAttempts)
    {
        Attempts++; LastError = error.Length > 300 ? error[..300] : error;
        if (Attempts >= maxAttempts) { Status = RecipientStatus.Failed; NextSendAt = null; }
        else NextSendAt = retryAtUtc;
    }

    public void Close(string status) { Status = status; NextSendAt = null; }
    public void Delay(DateTime untilUtc) => NextSendAt = untilUtc;
}

/// <summary>A conversation with one counterparty. Replies join the thread their outgoing mail started.</summary>
public sealed class OutreachThread
{
    private OutreachThread() { }

    public OutreachThread(Guid mailboxId, string counterparty, string subject, Guid? prospectId, Guid? campaignId)
    {
        Id = Guid.NewGuid(); MailboxId = mailboxId; Counterparty = counterparty.Trim().ToLowerInvariant();
        Subject = subject.Length > 300 ? subject[..300] : subject; ProspectId = prospectId; CampaignId = campaignId;
    }

    public Guid      Id           { get; private set; }
    public Guid      MailboxId    { get; private set; }
    public Guid?     ProspectId   { get; private set; }
    public Guid?     CampaignId   { get; private set; }
    public string    Counterparty { get; private set; } = null!;
    public string    Subject      { get; private set; } = null!;
    public string?   ProviderThreadId { get; private set; }
    public string    Classification { get; private set; } = ThreadClass.None;
    public int       MessageCount { get; private set; }
    public int       UnreadCount  { get; private set; }
    public bool      HasReply     { get; private set; }
    public Guid?     AssignedUserId { get; private set; }
    public string?   AssignedName { get; private set; }
    public bool      IsArchived   { get; private set; }
    public DateTime  LastMessageAt { get; private set; } = DateTime.UtcNow;
    public string?   Snippet      { get; private set; }
    public DateTime  CreatedAt    { get; private set; } = DateTime.UtcNow;
    public bool      IsDeleted    { get; private set; }

    public void SetProviderThread(string? id) { if (!string.IsNullOrWhiteSpace(id)) ProviderThreadId = id; }

    public void AddMessage(string direction, DateTime at, string? snippet)
    {
        MessageCount++; if (at > LastMessageAt || MessageCount == 1) LastMessageAt = at;
        if (!string.IsNullOrWhiteSpace(snippet)) Snippet = snippet.Length > 200 ? snippet[..200] : snippet;
        if (direction == MessageDirection.In) { UnreadCount++; HasReply = true; IsArchived = false; }
    }

    public void MarkRead() => UnreadCount = 0;
    public void Classify(string c) => Classification = c;
    public void Assign(Guid? userId, string? name) { AssignedUserId = userId; AssignedName = Text.OrNull(name); }
    public void Archive(bool archived) => IsArchived = archived;
    public void Delete() => IsDeleted = true;
}

public sealed class OutreachMessage
{
    private OutreachMessage() { }

    public OutreachMessage(Guid threadId, Guid mailboxId, string direction, string from, string to, string subject)
    {
        Id = Guid.NewGuid(); ThreadId = threadId; MailboxId = mailboxId; Direction = direction;
        FromAddress = from; ToAddress = to; Subject = subject.Length > 300 ? subject[..300] : subject;
    }

    public Guid      Id           { get; private set; }
    public Guid      ThreadId     { get; private set; }
    public Guid      MailboxId    { get; private set; }
    public Guid?     CampaignId   { get; private set; }
    public Guid?     RecipientId  { get; private set; }
    public int?      StepNumber   { get; private set; }
    public string    Direction    { get; private set; } = MessageDirection.Out;
    public string    Status       { get; private set; } = MessageStatus.Queued;
    public string    FromAddress  { get; private set; } = null!;
    public string    ToAddress    { get; private set; } = null!;
    public string?   Cc           { get; private set; }
    public string    Subject      { get; private set; } = null!;
    public string?   BodyText     { get; private set; }
    public string?   BodyHtml     { get; private set; }
    /// <summary>The Message-ID header. Replies point at it through In-Reply-To, which is how threads are rebuilt.</summary>
    public string?   MessageIdHeader { get; private set; }
    public string?   InReplyTo    { get; private set; }
    public string?   ProviderMessageId { get; private set; }
    public string?   Error        { get; private set; }
    public bool      IsRead       { get; private set; }
    public DateTime  OccurredAt   { get; private set; } = DateTime.UtcNow;
    public bool      IsDeleted    { get; private set; }

    public void SetCampaign(Guid campaignId, Guid recipientId, int step) { CampaignId = campaignId; RecipientId = recipientId; StepNumber = step; }

    public void SetContent(string? text, string? html, string? messageId, string? inReplyTo, string? cc)
    { BodyText = text; BodyHtml = html; MessageIdHeader = messageId; InReplyTo = inReplyTo; Cc = Text.OrNull(cc); }

    public void MarkSent(string? providerId, DateTime at) { Status = MessageStatus.Sent; ProviderMessageId = providerId; OccurredAt = at; }
    public void MarkFailed(string error) { Status = MessageStatus.Failed; Error = error.Length > 400 ? error[..400] : error; }
    public void MarkBounced(string? reason) { Status = MessageStatus.Bounced; Error = reason; }
    public void MarkReceived(string? providerId, DateTime at) { Status = MessageStatus.Received; ProviderMessageId = providerId; OccurredAt = at; IsRead = false; }
    public void SetRead(bool read) => IsRead = read;
}
