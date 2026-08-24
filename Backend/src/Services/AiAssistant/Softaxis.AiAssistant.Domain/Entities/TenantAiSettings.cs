using Softaxis.AiAssistant.Domain.Enums;

namespace Softaxis.AiAssistant.Domain.Entities;

/// <summary>
/// One row per tenant holding that tenant's AI-assistant configuration. The tenant admin
/// picks a provider, pastes their own API key (stored encrypted — never in plaintext),
/// chooses a model, and toggles which channels/features are enabled for their plan tier.
///
/// Tenant isolation is applied by the shared <c>TenantIsolation</c> shadow-column filter,
/// so reads/writes are automatically scoped to the current tenant — a tenant can only ever
/// see or change its own settings.
/// </summary>
public sealed class TenantAiSettings
{
    // EF ctor
    private TenantAiSettings() { }

    public TenantAiSettings(AiProvider provider)
    {
        Id       = Guid.NewGuid();
        Provider = provider;
        Enabled  = false;
        Tier     = "starter";
    }

    public Guid       Id       { get; private set; }
    public AiProvider Provider { get; private set; }

    /// <summary>The tenant's API key, encrypted at rest via Data Protection. Never returned to the client.</summary>
    public string? ProtectedApiKey { get; private set; }

    /// <summary>Model id for the chosen provider (e.g. "claude-opus-4-8", "llama-3.3-70b-versatile").</summary>
    public string? Model { get; private set; }

    /// <summary>Master switch — when false the assistant is unavailable for the tenant.</summary>
    public bool Enabled { get; private set; }

    /// <summary>Plan tier: "starter" | "growth" | "enterprise" — gates premium features.</summary>
    public string Tier { get; private set; } = "starter";

    // ── Feature toggles (gated by tier in the application layer) ──────────────
    public bool VoiceEnabled    { get; private set; }
    public bool TelegramEnabled { get; private set; }

    // ── Telegram bot (per-tenant bot; users link their own accounts to it) ────
    /// <summary>The tenant's Telegram bot token, encrypted at rest. Never returned to the client.</summary>
    public string? ProtectedTelegramBotToken { get; private set; }
    /// <summary>The bot's @username (for building t.me deep links).</summary>
    public string? TelegramBotUsername { get; private set; }
    /// <summary>Random key embedded in the inbound webhook URL, so Telegram updates resolve to this tenant.</summary>
    public string? TelegramInboundKey { get; private set; }

    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    // ── Fallback provider (optional, BYO — tenant's own second key) ──────────
    // Tried once, only on a retryable failure of the primary (rate limit / 5xx / timeout), never
    // charged unless the primary actually failed. Null FallbackProvider = feature off.
    public AiProvider? FallbackProvider        { get; private set; }
    public string?     FallbackProtectedApiKey { get; private set; }
    public string?     FallbackModel           { get; private set; }

    /// <summary>True when a key has been stored (used to tell the UI a key is set without exposing it).</summary>
    public bool HasApiKey => !string.IsNullOrEmpty(ProtectedApiKey);

    public bool HasFallbackApiKey => !string.IsNullOrEmpty(FallbackProtectedApiKey);

    /// <summary>True only when a fallback provider is chosen AND a key is actually stored for it.</summary>
    public bool FallbackConfigured => FallbackProvider is not null && HasFallbackApiKey;

    public bool HasTelegramBotToken => !string.IsNullOrEmpty(ProtectedTelegramBotToken);

    public void Configure(AiProvider provider, string? model, string tier, bool enabled,
                          bool voiceEnabled, bool telegramEnabled)
    {
        Provider        = provider;
        Model           = string.IsNullOrWhiteSpace(model) ? null : model.Trim();
        Tier            = string.IsNullOrWhiteSpace(tier) ? "starter" : tier.Trim().ToLowerInvariant();
        Enabled         = enabled;
        VoiceEnabled    = voiceEnabled;
        TelegramEnabled = telegramEnabled;
    }

    /// <summary>Store a new (already-encrypted) API key. Pass null to leave the existing key untouched.</summary>
    public void SetProtectedApiKey(string? protectedApiKey)
    {
        if (protectedApiKey is not null)
            ProtectedApiKey = protectedApiKey;
    }

    public void ClearApiKey() => ProtectedApiKey = null;

    /// <summary>
    /// Chooses (or clears) the fallback provider + model. Passing a null provider disables the
    /// fallback and drops any stored fallback key too — a key with no provider is orphaned data.
    /// </summary>
    public void ConfigureFallback(AiProvider? provider, string? model)
    {
        FallbackProvider = provider;
        FallbackModel    = string.IsNullOrWhiteSpace(model) ? null : model.Trim();
        if (provider is null)
            FallbackProtectedApiKey = null;
    }

    /// <summary>Store a new (already-encrypted) fallback API key. Pass null to leave the existing key untouched.</summary>
    public void SetFallbackProtectedApiKey(string? protectedApiKey)
    {
        if (protectedApiKey is not null)
            FallbackProtectedApiKey = protectedApiKey;
    }

    public void ClearFallbackApiKey() => FallbackProtectedApiKey = null;

    /// <summary>Configure the Telegram bot. Pass a null token to leave the stored token unchanged.</summary>
    public void ConfigureTelegramBot(string? protectedBotToken, string? botUsername)
    {
        if (protectedBotToken is not null)
            ProtectedTelegramBotToken = protectedBotToken;
        if (botUsername is not null)
            TelegramBotUsername = string.IsNullOrWhiteSpace(botUsername) ? null : botUsername.Trim().TrimStart('@');

        // Ensure an inbound key exists once a bot is configured.
        if (HasTelegramBotToken && string.IsNullOrEmpty(TelegramInboundKey))
            TelegramInboundKey = Guid.NewGuid().ToString("N");
    }

    public void ClearTelegramBot()
    {
        ProtectedTelegramBotToken = null;
        TelegramBotUsername = null;
        // Keep the inbound key stable so an already-registered webhook URL keeps resolving.
    }
}
