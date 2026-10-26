using System.Text.Json;

namespace Softaxis.CRM.Domain.Entities.Integrations;

/// <summary>
/// Which CRM stage changes are reported back to Meta, and under what event name.
///
/// <para>Meta optimises an ad towards whatever it is told a lead later became. Told only "a lead arrived"
/// it can only find more people who fill in forms; told which of them were qualified or bought, it finds
/// more people like those. The names are the tenant's to change — they pick which one Meta optimises for.</para>
/// </summary>
public static class MetaConversionDefaults
{
    /// <summary>
    /// Lead status → event. A status with no entry (or a blank one) sends nothing.
    /// "new" is blank on purpose: Meta already counted the lead when the form was submitted, and sending
    /// it back as a "Lead" event makes the campaign's Leads column count every lead twice.
    /// </summary>
    public static readonly IReadOnlyDictionary<string, string> LeadEvents = new Dictionary<string, string>
    {
        ["new"]         = "",
        ["contacted"]   = "Contacted",
        ["qualified"]   = "Qualified",
        ["converted"]   = "Opportunity",
        ["unqualified"] = "Unqualified",
        ["lost"]        = "Lead lost",
    };

    /// <summary>
    /// Opportunity stage → event. "lead" and "qualified" are left out on purpose: an opportunity is born at
    /// "qualified" when its lead converts, and the lead's own "Opportunity" event already says that.
    /// </summary>
    public static readonly IReadOnlyDictionary<string, string> DealEvents = new Dictionary<string, string>
    {
        ["proposal"]    = "Proposal",
        ["negotiation"] = "Negotiation",
        ["won"]         = "Won",
        ["lost"]        = "Deal lost",
    };

    public static readonly string[] LeadStatuses = ["new", "contacted", "qualified", "converted", "unqualified", "lost"];
    public static readonly string[] DealStages   = ["proposal", "negotiation", "won", "lost"];
}

/// <summary>
/// A tenant's Conversions API link for ONE Meta integration: which Meta dataset (pixel) receives the lead
/// stage events, the token that may write to it, and what to send.
///
/// <para>The token is encrypted at rest and never returned to the client. It is separate from the OAuth
/// token the integration uses to READ leads: sending events needs a token generated for the dataset, and
/// keeping it on its own row means reconnecting Lead Ads (which rewrites the integration's credentials)
/// never wipes it.</para>
/// </summary>
public sealed class MetaConversionSettings
{
    private MetaConversionSettings() { }

    public MetaConversionSettings(Guid integrationId)
    {
        Id            = Guid.NewGuid();
        IntegrationId = integrationId;
        SendDealValue = true;
        CreatedAt     = DateTime.UtcNow;
    }

    public Guid      Id            { get; private set; }
    public Guid      IntegrationId { get; private set; }
    public bool      Enabled       { get; private set; }
    public string?   DatasetId     { get; private set; }
    /// <summary>Encrypted dataset access token. NEVER returned to the client.</summary>
    public string?   AccessToken   { get; private set; }
    /// <summary>JSON { status: eventName }. Null = use the defaults. A blank name = send nothing for it.</summary>
    public string?   LeadEvents    { get; private set; }
    public string?   DealEvents    { get; private set; }
    /// <summary>Attach the opportunity's value (and currency) to its stage events.</summary>
    public bool      SendDealValue { get; private set; }
    /// <summary>Country calling code (digits, e.g. 971) used to complete local numbers that start with 0.</summary>
    public string?   DefaultCallingCode { get; private set; }

    public string?   DatasetName     { get; private set; }
    public DateTime? LastVerifiedAt  { get; private set; }
    public DateTime? EnabledAt       { get; private set; }
    public DateTime? LastSentAt      { get; private set; }
    public DateTime? LastFailureAt   { get; private set; }
    public string?   LastError       { get; private set; }

    public DateTime  CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }

    public bool IsReady => Enabled && !string.IsNullOrWhiteSpace(DatasetId) && !string.IsNullOrWhiteSpace(AccessToken);

    public void Configure(bool enabled, string? datasetId, bool sendDealValue, string? defaultCallingCode,
        IReadOnlyDictionary<string, string>? leadEvents, IReadOnlyDictionary<string, string>? dealEvents)
    {
        var newDataset = Clean(datasetId);
        // A different dataset means a different place the verification result and any earlier error belong to.
        if (!string.Equals(DatasetId, newDataset, StringComparison.Ordinal))
        {
            DatasetName = null; LastVerifiedAt = null; LastError = null; LastFailureAt = null;
        }
        DatasetId = newDataset;
        SendDealValue = sendDealValue;
        DefaultCallingCode = CleanDigits(defaultCallingCode);
        LeadEvents = leadEvents is null ? null : JsonSerializer.Serialize(Normalise(leadEvents));
        DealEvents = dealEvents is null ? null : JsonSerializer.Serialize(Normalise(dealEvents));

        if (enabled && !Enabled) EnabledAt = DateTime.UtcNow;
        Enabled = enabled;
        Touch();
    }

    public void SetAccessToken(string? encrypted)
    {
        AccessToken = encrypted;
        // A new token is a new chance: clear the last failure so a stale "token invalid" does not linger.
        LastError = null; LastFailureAt = null;
        Touch();
    }

    public void RecordVerified(string? datasetName)
    {
        DatasetName = datasetName; LastVerifiedAt = DateTime.UtcNow;
        LastError = null; LastFailureAt = null;
        Touch();
    }

    public void RecordSent() { LastSentAt = DateTime.UtcNow; LastError = null; Touch(); }

    /// <summary>A test event got through, so an earlier failure no longer describes the current setup.</summary>
    public void ClearError() { LastError = null; LastFailureAt = null; Touch(); }

    public void RecordFailure(string error)
    {
        LastFailureAt = DateTime.UtcNow;
        LastError = error.Length > 1000 ? error[..1000] : error;
        Touch();
    }

    /// <summary>The event name for a lead status, or null when nothing should be sent for it.</summary>
    public string? LeadEventFor(string status) => Lookup(LeadEvents, MetaConversionDefaults.LeadEvents, status);

    /// <summary>The event name for an opportunity stage, or null when nothing should be sent for it.</summary>
    public string? DealEventFor(string stage) => Lookup(DealEvents, MetaConversionDefaults.DealEvents, stage);

    /// <summary>The mapping in force (stored, else defaults) — what the screen shows and the sender uses.</summary>
    public IReadOnlyDictionary<string, string> EffectiveLeadEvents() => Effective(LeadEvents, MetaConversionDefaults.LeadEvents, MetaConversionDefaults.LeadStatuses);
    public IReadOnlyDictionary<string, string> EffectiveDealEvents() => Effective(DealEvents, MetaConversionDefaults.DealEvents, MetaConversionDefaults.DealStages);

    private static string? Lookup(string? stored, IReadOnlyDictionary<string, string> defaults, string key)
    {
        var map = Parse(stored) ?? defaults;
        return map.TryGetValue(key.Trim().ToLowerInvariant(), out var v) && !string.IsNullOrWhiteSpace(v) ? v.Trim() : null;
    }

    private static IReadOnlyDictionary<string, string> Effective(
        string? stored, IReadOnlyDictionary<string, string> defaults, string[] keys)
    {
        var map = Parse(stored) ?? defaults;
        return keys.ToDictionary(k => k, k => map.TryGetValue(k, out var v) ? v : "");
    }

    private static Dictionary<string, string>? Parse(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try { return JsonSerializer.Deserialize<Dictionary<string, string>>(json); }
        catch (JsonException) { return null; }   // an unreadable mapping falls back to the defaults, never to "send nothing"
    }

    private static Dictionary<string, string> Normalise(IReadOnlyDictionary<string, string> map) =>
        map.ToDictionary(kv => kv.Key.Trim().ToLowerInvariant(),
                         kv => (kv.Value ?? "").Trim().Length > 100 ? kv.Value!.Trim()[..100] : (kv.Value ?? "").Trim());

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
    private static string? CleanDigits(string? s)
    {
        var d = new string((s ?? "").Where(char.IsAsciiDigit).ToArray());
        return d.Length is >= 1 and <= 4 ? d : null;
    }
    private void Touch() => UpdatedAt = DateTime.UtcNow;
}

public static class MetaConversionStatus
{
    public const string Pending = "pending";
    public const string Sent    = "sent";
    public const string Failed  = "failed";
    public const string Skipped = "skipped";
}

/// <summary>
/// One stage change waiting to be reported to Meta (an outbox row). Written in the SAME save as the change
/// it describes, so a stage can never move without the event being queued, and sent later by a background
/// worker, so a slow or unreachable Meta never delays the person moving the lead.
///
/// <para>Holds only HASHED contact details (what Meta asks for) — never the readable email or phone.</para>
/// </summary>
public sealed class MetaConversionEvent
{
    private MetaConversionEvent() { }

    public MetaConversionEvent(Guid integrationId, Guid leadId, Guid? dealId, string eventName,
        DateTime eventTime, string metaLeadId, string userDataJson, decimal? value, string? currency)
    {
        Id            = Guid.NewGuid();
        IntegrationId = integrationId;
        LeadId        = leadId;
        DealId        = dealId;
        EventName     = eventName;
        EventTime     = eventTime;
        MetaLeadId    = metaLeadId;
        UserDataJson  = userDataJson;
        Value         = value;
        Currency      = currency;
        Status        = MetaConversionStatus.Pending;
        CreatedAt     = DateTime.UtcNow;
    }

    public Guid      Id            { get; private set; }
    public Guid      IntegrationId { get; private set; }
    public Guid      LeadId        { get; private set; }
    public Guid?     DealId        { get; private set; }
    public string    EventName     { get; private set; } = string.Empty;
    /// <summary>When the stage actually changed (UTC) — not when it was sent.</summary>
    public DateTime  EventTime     { get; private set; }
    public string    MetaLeadId    { get; private set; } = string.Empty;
    public string    UserDataJson  { get; private set; } = "{}";
    public decimal?  Value         { get; private set; }
    public string?   Currency      { get; private set; }

    public string    Status        { get; private set; } = MetaConversionStatus.Pending;
    public int       Attempts      { get; private set; }
    public DateTime? NextAttemptAt { get; private set; }
    public DateTime? SentAt        { get; private set; }
    public string?   LastError     { get; private set; }
    public DateTime  CreatedAt     { get; private set; }

    /// <summary>After this many failed tries the event is given up on and shown as failed.</summary>
    public const int MaxAttempts = 7;

    public void MarkSent() { Status = MetaConversionStatus.Sent; SentAt = DateTime.UtcNow; LastError = null; NextAttemptAt = null; }

    public void MarkSkipped(string reason) { Status = MetaConversionStatus.Skipped; LastError = Clip(reason); NextAttemptAt = null; }

    /// <summary>A failure retrying cannot fix (Meta rejected the request itself).</summary>
    public void MarkFailed(string error) { Attempts++; Status = MetaConversionStatus.Failed; LastError = Clip(error); NextAttemptAt = null; }

    /// <summary>A failure that may pass on its own (Meta busy, network). Backs off, then gives up after <see cref="MaxAttempts"/>.</summary>
    public void ScheduleRetry(string error)
    {
        Attempts++;
        LastError = Clip(error);
        if (Attempts >= MaxAttempts) { Status = MetaConversionStatus.Failed; NextAttemptAt = null; return; }
        NextAttemptAt = DateTime.UtcNow + Attempts switch
        {
            1 => TimeSpan.FromMinutes(1),
            2 => TimeSpan.FromMinutes(5),
            3 => TimeSpan.FromMinutes(30),
            4 => TimeSpan.FromHours(2),
            5 => TimeSpan.FromHours(6),
            _ => TimeSpan.FromHours(12),
        };
    }

    /// <summary>Puts a failed event back in the queue — used after the token or dataset has been fixed.</summary>
    public void Requeue() { Status = MetaConversionStatus.Pending; Attempts = 0; NextAttemptAt = null; LastError = null; }

    private static string Clip(string s) => s.Length > 1000 ? s[..1000] : s;
}
