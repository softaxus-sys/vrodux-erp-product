namespace Softaxis.Messaging.Domain.Entities;

/// <summary>
/// A workspace's own WhatsApp Business number on the Meta Cloud API. One per workspace.
/// The access token is stored encrypted; nothing outside the infrastructure layer sees it in clear.
/// Also holds the automatic-reply settings, since they belong to the number.
/// </summary>
public sealed class WaConnection
{
    private WaConnection() { }

    public WaConnection(string phoneNumberId, string wabaId, string accessTokenCipher)
    {
        Id = Guid.NewGuid();
        PhoneNumberId = phoneNumberId.Trim();
        WabaId = wabaId.Trim();
        AccessTokenCipher = accessTokenCipher;
        ConnectedAt = DateTime.UtcNow;
        EnsureVerifyToken();
    }

    public Guid      Id                { get; private set; }
    /// <summary>Meta's id for the sending number. Also how an incoming webhook finds its workspace.</summary>
    public string    PhoneNumberId     { get; private set; } = null!;
    public string    WabaId            { get; private set; } = null!;
    public string    AccessTokenCipher { get; private set; } = null!;
    /// <summary>
    /// This workspace's own Meta app secret (encrypted). Meta signs every webhook delivery with the
    /// secret of the app that sent it, so a workspace on its own Meta app needs its own secret here.
    /// Null = the workspace uses the shared Vrodux app, checked against the server-wide secret.
    /// </summary>
    public string?   AppSecretCipher   { get; private set; }
    /// <summary>Random token this workspace pastes into its Meta app's webhook setup. Unique.</summary>
    public string?   WebhookVerifyToken { get; private set; }
    public string?   DisplayPhone      { get; private set; }
    public string?   VerifiedName      { get; private set; }
    /// <summary>connected | error | disconnected</summary>
    public string    Status            { get; private set; } = WaConnectionStatus.Connected;
    public string?   LastError         { get; private set; }
    public DateTime  ConnectedAt       { get; private set; }
    public DateTime? UpdatedAt         { get; private set; }

    // ── Automatic replies ────────────────────────────────────────────────────
    public bool      WelcomeEnabled    { get; private set; }
    public string?   WelcomeMessage    { get; private set; }
    public bool      AwayEnabled       { get; private set; }
    public string?   AwayMessage       { get; private set; }
    /// <summary>Business hours decide when the away message is used, in this time zone.</summary>
    public string    TimeZoneId        { get; private set; } = "Asia/Dubai";
    public string    OpensAt           { get; private set; } = "09:00";
    public string    ClosesAt          { get; private set; } = "18:00";
    /// <summary>Comma-separated DayOfWeek numbers (0 = Sunday). Default Mon–Fri.</summary>
    public string    WorkDays          { get; private set; } = "1,2,3,4,5";
    /// <summary>An unknown number that writes in becomes a CRM lead (when the workspace has CRM).</summary>
    public bool      CreateLeads       { get; private set; } = true;
    /// <summary>Country code put in front of a local number (one starting with 0), e.g. "971".</summary>
    public string    DefaultCountryCode { get; private set; } = "971";

    public void Reconnect(string phoneNumberId, string wabaId, string accessTokenCipher)
    {
        PhoneNumberId = phoneNumberId.Trim();
        WabaId = wabaId.Trim();
        AccessTokenCipher = accessTokenCipher;
        Status = WaConnectionStatus.Connected;
        LastError = null;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Blank leaves the stored secret as it is; replace it by passing a new one.</summary>
    public void SetAppSecret(string? cipher)
    {
        if (cipher is null) return;
        AppSecretCipher = cipher;
        UpdatedAt = DateTime.UtcNow;
    }

    public void ClearAppSecret() { AppSecretCipher = null; UpdatedAt = DateTime.UtcNow; }

    /// <summary>Gives a connection made before verify tokens existed one of its own.</summary>
    public bool EnsureVerifyToken()
    {
        if (!string.IsNullOrEmpty(WebhookVerifyToken)) return false;
        WebhookVerifyToken = "vrx_" + Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(20)).ToLowerInvariant();
        return true;
    }

    public void SetProfile(string? displayPhone, string? verifiedName)
    {
        DisplayPhone = displayPhone;
        VerifiedName = verifiedName;
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkHealthy() { Status = WaConnectionStatus.Connected; LastError = null; }

    public void MarkError(string error)
    {
        Status = WaConnectionStatus.Error;
        LastError = error.Length > 500 ? error[..500] : error;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Disconnect() { Status = WaConnectionStatus.Disconnected; UpdatedAt = DateTime.UtcNow; }

    public void UpdateAutoReplies(bool welcomeEnabled, string? welcomeMessage, bool awayEnabled,
        string? awayMessage, string timeZoneId, string opensAt, string closesAt, string workDays, bool createLeads, string defaultCountryCode)
    {
        WelcomeEnabled = welcomeEnabled;
        WelcomeMessage = Clean(welcomeMessage);
        AwayEnabled    = awayEnabled;
        AwayMessage    = Clean(awayMessage);
        TimeZoneId     = timeZoneId;
        OpensAt        = opensAt;
        ClosesAt       = closesAt;
        WorkDays       = workDays;
        CreateLeads    = createLeads;
        DefaultCountryCode = new string(defaultCountryCode.Where(char.IsDigit).ToArray());
        UpdatedAt      = DateTime.UtcNow;
    }

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}

public static class WaConnectionStatus
{
    public const string Connected    = "connected";
    public const string Error        = "error";
    public const string Disconnected = "disconnected";
}

/// <summary>A message template as Meta holds it. Synced from Meta; Meta decides approval.</summary>
public sealed class WaTemplate
{
    private WaTemplate() { }

    public WaTemplate(string name, string language)
    {
        Id = Guid.NewGuid();
        Name = name;
        Language = language;
    }

    public Guid      Id             { get; private set; }
    public string    Name           { get; private set; } = null!;
    public string    Language       { get; private set; } = null!;
    public string?   MetaTemplateId { get; private set; }
    /// <summary>MARKETING | UTILITY | AUTHENTICATION</summary>
    public string    Category       { get; private set; } = "UTILITY";
    /// <summary>APPROVED | PENDING | REJECTED | PAUSED | DISABLED</summary>
    public string    Status         { get; private set; } = "PENDING";
    public string?   HeaderText     { get; private set; }
    public string    BodyText       { get; private set; } = "";
    public string?   FooterText     { get; private set; }
    /// <summary>How many {{n}} placeholders the body has.</summary>
    public int       VariableCount  { get; private set; }
    public string?   RejectedReason { get; private set; }
    public DateTime  SyncedAt       { get; private set; } = DateTime.UtcNow;

    public void Apply(string? metaId, string category, string status, string? header, string body,
        string? footer, int variableCount, string? rejectedReason)
    {
        MetaTemplateId = metaId;
        Category       = category;
        Status         = status;
        HeaderText     = header;
        BodyText       = body;
        FooterText     = footer;
        VariableCount  = variableCount;
        RejectedReason = rejectedReason;
        SyncedAt       = DateTime.UtcNow;
    }
}

/// <summary>One chat with one phone number.</summary>
public sealed class WaConversation
{
    private WaConversation() { }

    public WaConversation(string contactPhone, string? contactName)
    {
        Id = Guid.NewGuid();
        ContactPhone = contactPhone;
        ContactName = contactName;
        CreatedAt = DateTime.UtcNow;
    }

    public Guid      Id                 { get; private set; }
    /// <summary>Digits only, with country code (E.164 without "+").</summary>
    public string    ContactPhone       { get; private set; } = null!;
    public string?   ContactName        { get; private set; }
    /// <summary>The record this chat is about, when known: lead | prospect | customer | …</summary>
    public string?   RelatedType        { get; private set; }
    public Guid?     RelatedId          { get; private set; }
    public string?   RelatedName        { get; private set; }
    /// <summary>Opens Meta's 24-hour window for free-form replies.</summary>
    public DateTime? LastInboundAt      { get; private set; }
    public DateTime  LastMessageAt      { get; private set; }
    public string?   LastMessagePreview { get; private set; }
    public int       UnreadCount        { get; private set; }
    /// <summary>The contact asked to stop. Nothing is sent to them until they write again.</summary>
    public bool      OptedOut           { get; private set; }
    public DateTime? LastWelcomeAt      { get; private set; }
    public DateTime? LastAwayAt         { get; private set; }
    public DateTime  CreatedAt          { get; private set; }

    public bool WindowOpen(DateTime nowUtc) =>
        LastInboundAt.HasValue && nowUtc - LastInboundAt.Value < TimeSpan.FromHours(24);

    public void LinkTo(string? type, Guid? id, string? name)
    {
        if (type is null || id is null) return;
        RelatedType = type;
        RelatedId   = id;
        RelatedName = name ?? RelatedName;
    }

    public void SetName(string? name) { if (!string.IsNullOrWhiteSpace(name)) ContactName ??= name.Trim(); }

    public void RecordInbound(string preview, DateTime at)
    {
        LastInboundAt      = at;
        LastMessageAt      = at;
        LastMessagePreview = Cut(preview);
        UnreadCount++;
    }

    public void RecordOutbound(string preview, DateTime at)
    {
        LastMessageAt      = at;
        LastMessagePreview = Cut(preview);
    }

    public void MarkRead() => UnreadCount = 0;
    public void OptOut()   => OptedOut = true;
    public void OptIn()    => OptedOut = false;
    public void MarkWelcomed(DateTime at) => LastWelcomeAt = at;
    public void MarkAwaySent(DateTime at) => LastAwayAt = at;

    private static string Cut(string s) => s.Length > 200 ? s[..200] : s;
}

public sealed class WaMessage
{
    private WaMessage() { }

    public WaMessage(Guid conversationId, string direction, string type, string body)
    {
        Id = Guid.NewGuid();
        ConversationId = conversationId;
        Direction = direction;
        Type = type;
        Body = body;
        CreatedAt = DateTime.UtcNow;
    }

    public Guid      Id             { get; private set; }
    public Guid      ConversationId { get; private set; }
    /// <summary>in | out</summary>
    public string    Direction      { get; private set; } = null!;
    /// <summary>text | template | image | document | audio | video | location | other</summary>
    public string    Type           { get; private set; } = null!;
    public string    Body           { get; private set; } = null!;
    public string?   TemplateName   { get; private set; }
    /// <summary>Meta's message id ("wamid…"); status webhooks are matched on it.</summary>
    public string?   WaMessageId    { get; private set; }
    /// <summary>queued | sent | delivered | read | failed | received</summary>
    public string    Status         { get; private set; } = WaMessageStatus.Queued;
    public string?   Error          { get; private set; }
    /// <summary>manual | automation | auto_reply | inbound</summary>
    public string    Origin         { get; private set; } = WaOrigin.Manual;
    public Guid?     SentByUserId   { get; private set; }
    public string?   SentByName     { get; private set; }
    public string?   RelatedType    { get; private set; }
    public Guid?     RelatedId      { get; private set; }
    public DateTime  CreatedAt      { get; private set; }
    public DateTime? StatusAt       { get; private set; }

    public void Describe(string origin, string? templateName, Guid? userId, string? userName,
        string? relatedType, Guid? relatedId)
    {
        Origin = origin;
        TemplateName = templateName;
        SentByUserId = userId;
        SentByName = userName;
        RelatedType = relatedType;
        RelatedId = relatedId;
    }

    public void MarkReceived(string waId) { WaMessageId = waId; Status = WaMessageStatus.Received; Origin = WaOrigin.Inbound; }
    public void MarkSent(string waId)     { WaMessageId = waId; SetStatus(WaMessageStatus.Sent); }
    public void MarkFailed(string error)  { Error = error.Length > 500 ? error[..500] : error; SetStatus(WaMessageStatus.Failed); }

    /// <summary>Status webhooks can arrive out of order; never move a message backwards.</summary>
    public void ApplyStatus(string status, string? error)
    {
        if (Rank(status) <= Rank(Status) && status != WaMessageStatus.Failed) return;
        if (status == WaMessageStatus.Failed && error is not null) Error = error.Length > 500 ? error[..500] : error;
        SetStatus(status);
    }

    private void SetStatus(string s) { Status = s; StatusAt = DateTime.UtcNow; }

    private static int Rank(string s) => s switch
    {
        WaMessageStatus.Queued    => 0,
        WaMessageStatus.Sent      => 1,
        WaMessageStatus.Delivered => 2,
        WaMessageStatus.Read      => 3,
        _                         => 4,
    };
}

public static class WaMessageStatus
{
    public const string Queued    = "queued";
    public const string Sent      = "sent";
    public const string Delivered = "delivered";
    public const string Read      = "read";
    public const string Failed    = "failed";
    public const string Received  = "received";
}

public static class WaOrigin
{
    public const string Manual     = "manual";
    public const string Automation = "automation";
    public const string AutoReply  = "auto_reply";
    public const string Inbound    = "inbound";
}

/// <summary>A keyword that triggers a fixed reply.</summary>
public sealed class WaKeywordRule
{
    private WaKeywordRule() { }

    public WaKeywordRule(string keyword, string matchType, string reply)
    {
        Id = Guid.NewGuid();
        Update(keyword, matchType, reply, true);
    }

    public Guid   Id        { get; private set; }
    public string Keyword   { get; private set; } = null!;
    /// <summary>contains | exact</summary>
    public string MatchType { get; private set; } = "contains";
    public string Reply     { get; private set; } = null!;
    public bool   IsActive  { get; private set; }

    public void Update(string keyword, string matchType, string reply, bool isActive)
    {
        Keyword   = keyword.Trim();
        MatchType = matchType == "exact" ? "exact" : "contains";
        Reply     = reply.Trim();
        IsActive  = isActive;
    }

    public bool Matches(string text)
    {
        var t = text.Trim();
        return MatchType == "exact"
            ? string.Equals(t, Keyword, StringComparison.OrdinalIgnoreCase)
            : t.Contains(Keyword, StringComparison.OrdinalIgnoreCase);
    }
}

/// <summary>
/// Sends a template automatically when something happens in another module.
/// Variables are filled from the record's fields, in order ({{1}}, {{2}}, …).
/// </summary>
public sealed class WaAutomation
{
    private WaAutomation() { }

    public WaAutomation(string eventKey)
    {
        Id = Guid.NewGuid();
        EventKey = eventKey;
        CreatedAt = DateTime.UtcNow;
    }

    public Guid      Id            { get; private set; }
    public string    EventKey      { get; private set; } = null!;
    public bool      Enabled       { get; private set; }
    public string?   TemplateName  { get; private set; }
    public string?   Language      { get; private set; }
    /// <summary>'|'-separated record fields for {{1}}, {{2}}, … e.g. "firstName|company".</summary>
    public string    VariableFields { get; private set; } = "";
    /// <summary>Records created before this are never messaged — switching on does not message the backlog.</summary>
    public DateTime? Watermark     { get; private set; }
    public DateTime  CreatedAt     { get; private set; }

    public void Update(bool enabled, string? templateName, string? language, string variableFields)
    {
        if (enabled && !Enabled) Watermark = DateTime.UtcNow;
        Enabled        = enabled;
        TemplateName   = templateName;
        Language       = language;
        VariableFields = variableFields;
    }

    public void Advance(DateTime to) { if (Watermark is null || to > Watermark) Watermark = to; }
}

public static class WaEvents
{
    public const string LeadCreated = "crm.lead.created";
}

/// <summary>Phone number helpers shared by every layer.</summary>
public static class WaPhone
{
    /// <summary>Digits only. A local number starting with 0 cannot be routed and returns null.</summary>
    public static string? Normalize(string? raw, string? defaultCountryCode = null)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var s = raw.Trim();
        if (s.StartsWith("00")) s = s[2..];
        var digits = new string(s.Where(char.IsDigit).ToArray());
        if (digits.StartsWith('0') && !s.StartsWith('+'))
        {
            if (string.IsNullOrEmpty(defaultCountryCode)) return null;
            digits = defaultCountryCode + digits.TrimStart('0');
        }
        if (digits.Length < 8 || digits.Length > 15 || digits.StartsWith('0')) return null;
        return digits;
    }
}
