using Softaxis.AiAssistant.Domain.Enums;

namespace Softaxis.AiAssistant.Domain.Entities;

/// <summary>
/// The platform-wide AI the super admin provides to every workspace that has not added its own key.
/// One row for the whole product (excluded from tenant isolation — see AiAssistantDbContext).
///
/// A workspace that brings its own key always uses it. This one is the default for everyone else,
/// and a safety net behind a workspace's own key when that provider is down or rate limited.
/// The key is encrypted at rest and never returned to any client.
/// </summary>
public sealed class PlatformAiSettings
{
    public static readonly Guid SingletonId = new("00000000-0000-0000-0000-00000000a1a1");

    // EF ctor
    private PlatformAiSettings() { }

    public static PlatformAiSettings CreateDefault() => new()
    {
        Id = SingletonId,
        Provider = AiProvider.OpenRouter,
        MonthlyMessageCapPerTenant = 100,
        NudgeEveryMessages = 10,
        ShowOwnKeyBanner = true,
        VoiceMonthlyCapPerTenant = 50,
        UpdatedAt = DateTime.UtcNow,
    };

    public Guid Id { get; private set; }

    // ── Text assistant ───────────────────────────────────────────────────────
    /// <summary>Master switch. Off = workspaces without their own key get "not configured".</summary>
    public bool Enabled { get; private set; }
    public AiProvider Provider { get; private set; }
    public string? Model { get; private set; }
    public string? ProtectedApiKey { get; private set; }

    /// <summary>Messages a workspace can send per calendar month through the platform key. 0 = unlimited.</summary>
    public int MonthlyMessageCapPerTenant { get; private set; }

    /// <summary>Every Nth platform-served message carries an "add your own key" suggestion. 0 = never.</summary>
    public int NudgeEveryMessages { get; private set; }

    /// <summary>Show the permanent "you are using the shared AI" note at the top of the assistant.</summary>
    public bool ShowOwnKeyBanner { get; private set; }

    // ── Voice ────────────────────────────────────────────────────────────────
    public bool VoiceEnabled { get; private set; }

    /// <summary>Speech-to-text model id (e.g. an audio-capable model on the provider).</summary>
    public string? SttModel { get; private set; }

    /// <summary>Text-to-speech model id.</summary>
    public string? TtsModel { get; private set; }

    /// <summary>Voice name passed to the speech model (provider specific, e.g. "alloy").</summary>
    public string? TtsVoice { get; private set; }

    /// <summary>Spoken turns a workspace can have per month on the platform voice. 0 = unlimited.</summary>
    public int VoiceMonthlyCapPerTenant { get; private set; }

    /// <summary>Optional separate key for voice; when empty the text key is used.</summary>
    public string? ProtectedVoiceApiKey { get; private set; }

    public DateTime UpdatedAt { get; private set; }

    public bool HasApiKey => !string.IsNullOrEmpty(ProtectedApiKey);
    public bool HasVoiceApiKey => !string.IsNullOrEmpty(ProtectedVoiceApiKey);

    public void ConfigureText(bool enabled, AiProvider provider, string? model, int monthlyCap, int nudgeEvery, bool showBanner)
    {
        Enabled = enabled;
        Provider = provider;
        Model = Clean(model);
        MonthlyMessageCapPerTenant = Math.Clamp(monthlyCap, 0, 1_000_000);
        NudgeEveryMessages = Math.Clamp(nudgeEvery, 0, 1000);
        ShowOwnKeyBanner = showBanner;
        UpdatedAt = DateTime.UtcNow;
    }

    public void ConfigureVoice(bool enabled, string? sttModel, string? ttsModel, string? ttsVoice, int monthlyCap)
    {
        VoiceEnabled = enabled;
        SttModel = Clean(sttModel);
        TtsModel = Clean(ttsModel);
        TtsVoice = Clean(ttsVoice);
        VoiceMonthlyCapPerTenant = Math.Clamp(monthlyCap, 0, 1_000_000);
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Pass null to leave the stored key untouched, "" is not accepted — use <see cref="ClearApiKey"/>.</summary>
    public void SetProtectedApiKey(string? protectedKey) { if (!string.IsNullOrEmpty(protectedKey)) { ProtectedApiKey = protectedKey; UpdatedAt = DateTime.UtcNow; } }
    public void ClearApiKey() { ProtectedApiKey = null; UpdatedAt = DateTime.UtcNow; }
    public void SetProtectedVoiceApiKey(string? protectedKey) { if (!string.IsNullOrEmpty(protectedKey)) { ProtectedVoiceApiKey = protectedKey; UpdatedAt = DateTime.UtcNow; } }
    public void ClearVoiceApiKey() { ProtectedVoiceApiKey = null; UpdatedAt = DateTime.UtcNow; }

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}

/// <summary>
/// How much of the platform AI one workspace used in one calendar month. Tenant-isolated, so a
/// workspace only ever sees and changes its own counters; the super admin reads them all.
/// </summary>
public sealed class PlatformAiUsage
{
    // EF ctor
    private PlatformAiUsage() { }

    public PlatformAiUsage(string month)
    {
        Id = Guid.NewGuid();
        Month = month;
    }

    public Guid Id { get; private set; }

    /// <summary>"yyyy-MM".</summary>
    public string Month { get; private set; } = null!;
    public int Messages { get; private set; }
    public int VoiceTurns { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    public void AddMessage() { Messages++; UpdatedAt = DateTime.UtcNow; }
    public void AddVoiceTurn() { VoiceTurns++; UpdatedAt = DateTime.UtcNow; }
}
