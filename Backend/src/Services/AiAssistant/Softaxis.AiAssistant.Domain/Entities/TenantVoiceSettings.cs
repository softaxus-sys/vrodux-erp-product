namespace Softaxis.AiAssistant.Domain.Entities;

/// <summary>
/// One row per tenant holding the AI outbound voice-agent configuration (BYO Vapi account —
/// the tenant pays for its own call minutes, mirroring the BYO LLM-key model). The persona
/// fields drive the call system prompt so the agent "sounds like" a real employee of the
/// tenant's company. Tenant-isolated via the shared <c>TenantIsolation</c> shadow column.
/// </summary>
public sealed class TenantVoiceSettings
{
    // EF ctor
    private TenantVoiceSettings() { }

    public TenantVoiceSettings(Guid runAsUserId)
    {
        Id          = Guid.NewGuid();
        RunAsUserId = runAsUserId;
        Enabled     = false;
        InboundKey  = Guid.NewGuid().ToString("N");
        WebhookSecret = Guid.NewGuid().ToString("N");
    }

    public Guid Id { get; private set; }

    /// <summary>Master switch — when false no outbound calls are scheduled or placed.</summary>
    public bool Enabled { get; private set; }

    /// <summary>The tenant's Vapi API key, encrypted at rest. Never returned to the client.</summary>
    public string? ProtectedVapiApiKey { get; private set; }

    /// <summary>The Vapi phone-number id used as the outbound caller ID (M2 adds per-region numbers).</summary>
    public string? VapiPhoneNumberId { get; private set; }

    /// <summary>Optional: a persistent assistant built in the tenant's Vapi dashboard. When set,
    /// calls use it (its own prompt/voice/transcriber) with per-lead variables injected, instead of
    /// the transient per-call assistant generated from the persona fields below.</summary>
    public string? VapiAssistantId { get; private set; }

    /// <summary>Random key embedded in the inbound webhook URL so Vapi events resolve to this tenant.</summary>
    public string InboundKey { get; private set; } = null!;

    /// <summary>Shared secret sent by Vapi as <c>x-vapi-secret</c>; the webhook rejects mismatches.</summary>
    public string WebhookSecret { get; private set; } = null!;

    /// <summary>The user the agent acts as for post-call CRM writes (lead status, notes) — its
    /// permissions and tenant bound the AI exactly like automation rules' run-as user.</summary>
    public Guid RunAsUserId { get; private set; }

    // ── Dialing behaviour ─────────────────────────────────────────────────────
    /// <summary>Minutes to wait after a lead arrives before calling (a 0–3 min jitter is added).</summary>
    public int CallDelayMinutes { get; private set; } = 5;

    /// <summary>Max call attempts per lead before it's marked not responding (retry machine = M2).</summary>
    public int MaxAttempts { get; private set; } = 3;

    /// <summary>Monthly spend guardrail in minutes; 0 = unlimited. Calls pause when reached.</summary>
    public int MonthlyMinutesCap { get; private set; }

    /// <summary>Minutes consumed in <see cref="UsageMonth"/> (from Vapi call durations).</summary>
    public decimal MinutesUsedThisMonth { get; private set; }

    /// <summary>The "yyyy-MM" month <see cref="MinutesUsedThisMonth"/> belongs to; rolls over automatically.</summary>
    public string? UsageMonth { get; private set; }

    /// <summary>Fallback language when the lead's language can't be resolved ("en" | "ur" | "ar").</summary>
    public string DefaultLanguage { get; private set; } = "en";

    // ── Persona / knowledge (drives the call system prompt) ───────────────────
    /// <summary>The name the agent introduces itself with ("Hi, this is Sara from …").</summary>
    public string? AgentName { get; private set; }
    public string? CompanyName { get; private set; }
    public string? CompanyDescription { get; private set; }
    public string? Industry { get; private set; }
    /// <summary>Free-text knowledge feed — what the agent is allowed to say/answer.</summary>
    public string? Knowledge { get; private set; }

    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    /// <summary>True when a key has been stored (tells the UI a key is set without exposing it).</summary>
    public bool HasVapiApiKey => !string.IsNullOrEmpty(ProtectedVapiApiKey);

    public void Configure(
        bool enabled, string? vapiPhoneNumberId, string? vapiAssistantId, Guid runAsUserId,
        int callDelayMinutes, int maxAttempts, int monthlyMinutesCap, string defaultLanguage,
        string? agentName, string? companyName, string? companyDescription, string? industry, string? knowledge)
    {
        Enabled            = enabled;
        VapiPhoneNumberId  = Clean(vapiPhoneNumberId);
        VapiAssistantId    = Clean(vapiAssistantId);
        if (runAsUserId != Guid.Empty) RunAsUserId = runAsUserId;
        CallDelayMinutes   = Math.Clamp(callDelayMinutes, 0, 24 * 60);
        MaxAttempts        = Math.Clamp(maxAttempts, 1, 10);
        MonthlyMinutesCap  = Math.Max(0, monthlyMinutesCap);
        DefaultLanguage    = string.IsNullOrWhiteSpace(defaultLanguage) ? "en" : defaultLanguage.Trim().ToLowerInvariant();
        AgentName          = Clean(agentName);
        CompanyName        = Clean(companyName);
        CompanyDescription = Clean(companyDescription);
        Industry           = Clean(industry);
        Knowledge          = Clean(knowledge);
    }

    /// <summary>Store a new (already-encrypted) Vapi key. Pass null to leave the existing key untouched.</summary>
    public void SetProtectedVapiApiKey(string? protectedKey)
    {
        if (protectedKey is not null)
            ProtectedVapiApiKey = protectedKey;
    }

    public void ClearVapiApiKey() => ProtectedVapiApiKey = null;

    /// <summary>Record consumed call minutes, rolling the counter over on a new month.</summary>
    public void AddMinutesUsed(decimal minutes, DateTime utcNow)
    {
        var month = utcNow.ToString("yyyy-MM");
        if (UsageMonth != month)
        {
            UsageMonth = month;
            MinutesUsedThisMonth = 0;
        }
        MinutesUsedThisMonth += Math.Max(0, minutes);
    }

    /// <summary>True when the monthly minutes cap is set and already reached for the current month.</summary>
    public bool IsOverMinutesCap(DateTime utcNow) =>
        MonthlyMinutesCap > 0
        && UsageMonth == utcNow.ToString("yyyy-MM")
        && MinutesUsedThisMonth >= MonthlyMinutesCap;

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}
