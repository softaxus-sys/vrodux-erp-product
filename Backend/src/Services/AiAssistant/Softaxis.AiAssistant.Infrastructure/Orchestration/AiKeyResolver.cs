using Microsoft.EntityFrameworkCore;
using Softaxis.AiAssistant.Application.Abstractions;
using Softaxis.AiAssistant.Application.Chat.Dtos;
using Softaxis.AiAssistant.Domain.Entities;
using Softaxis.AiAssistant.Domain.Enums;
using Softaxis.AiAssistant.Infrastructure.Persistence;

namespace Softaxis.AiAssistant.Infrastructure.Orchestration;

/// <summary>Everything one assistant call needs to reach a model, plus where the key came from.</summary>
public sealed record ResolvedAi(
    IAiChatProvider Provider, string Model, string ApiKey, AiProvider ProviderKind,
    IAiChatProvider? FallbackProvider, string? FallbackModel, string? FallbackApiKey, AiProvider? FallbackProviderKind,
    bool UsingPlatform, PlatformAiNoticeDto? Notice);

public interface IAiKeyResolver
{
    /// <summary>
    /// Picks the key for this workspace. <paramref name="countMessage"/> is true for a fresh user
    /// message (it spends one of the workspace's monthly platform messages); false for a follow-up
    /// step such as confirming an action the user already asked for.
    /// </summary>
    Task<ResolvedAi> ResolveAsync(bool countMessage, CancellationToken ct);

    /// <summary>
    /// Spends the message that <see cref="ResolveAsync"/> marked for counting. Called only after the
    /// model actually answered, so a broken platform key or a provider outage never eats a
    /// workspace's allowance. Returns the updated notice, or null when nothing was counted.
    /// </summary>
    Task<PlatformAiNoticeDto?> RecordMessageAsync(CancellationToken ct);

    /// <summary>What the settings screen needs to say about the shared AI, without spending anything.</summary>
    Task<PlatformAiNoticeDto?> PeekNoticeAsync(CancellationToken ct);
}

/// <summary>
/// The one place that decides whose key answers. Order: the workspace's own key, always, when it is
/// on and usable; otherwise the super admin's platform key. The platform key also backs up a
/// workspace's own key when that provider is rate limited or down, unless the workspace configured
/// its own second provider. A workspace that switched the assistant off while holding a key stays off.
/// </summary>
public sealed class AiKeyResolver(
    AiAssistantDbContext db, ISecretProtector protector, IAiProviderFactory providers) : IAiKeyResolver
{
    private PlatformAiUsage? _toCount;
    private PlatformAiSettings? _countedAgainst;

    public async Task<ResolvedAi> ResolveAsync(bool countMessage, CancellationToken ct)
    {
        _toCount = null; _countedAgainst = null;
        var own = await db.AiSettings.FirstOrDefaultAsync(ct);
        var platform = await db.PlatformAi.AsNoTracking().FirstOrDefaultAsync(ct);

        var ownKey = own is null ? null : protector.Unprotect(own.ProtectedApiKey);
        var ownModel = own is null ? null : ResolveModel(own.Provider, own.Model);
        var ownUsable = own is { Enabled: true } && !string.IsNullOrEmpty(ownKey) && ownModel is not null;

        if (ownUsable)
        {
            // Their own key, exactly as before. Their own second provider wins over the platform's.
            IAiChatProvider? fbProvider = null; string? fbModel = null, fbKey = null; AiProvider? fbKind = null;
            if (own!.FallbackConfigured)
            {
                var k = protector.Unprotect(own.FallbackProtectedApiKey);
                var m = ResolveModel(own.FallbackProvider!.Value, own.FallbackModel);
                if (!string.IsNullOrEmpty(k) && m is not null)
                {
                    fbProvider = providers.Create(own.FallbackProvider!.Value);
                    fbModel = m; fbKey = k; fbKind = own.FallbackProvider;
                }
            }
            if (fbProvider is null && PlatformReady(platform, out var pKey, out var pModel))
            {
                var used = await UsedAsync(ct);
                if (platform!.MonthlyMessageCapPerTenant == 0 || used.Messages < platform.MonthlyMessageCapPerTenant)
                {
                    fbProvider = providers.Create(platform.Provider);
                    fbModel = pModel; fbKey = pKey; fbKind = platform.Provider;
                }
            }
            return new ResolvedAi(providers.Create(own.Provider), ownModel!, ownKey!, own.Provider,
                fbProvider, fbModel, fbKey, fbKind, false, null);
        }

        // Switched off on purpose, with a key on file: respect it.
        if (own is { Enabled: false } && !string.IsNullOrEmpty(ownKey))
            throw new AiNotConfiguredException("The AI assistant is switched off for your company. An administrator can turn it on in Settings.");

        if (!PlatformReady(platform, out var key, out var model))
            throw new AiNotConfiguredException(own is null || string.IsNullOrEmpty(ownKey)
                ? "The AI assistant is not set up yet. Ask an administrator to add an AI provider key in Settings."
                : "No model is set for your AI provider. Pick a currently available model in Settings.");

        var usage = await UsedAsync(ct);
        var cap = platform!.MonthlyMessageCapPerTenant;
        if (cap > 0 && usage.Messages >= cap)
            throw new AiPlatformLimitException(
                $"Your company has used all {cap} messages of the shared AI for this month. " +
                "Add your own AI key in Settings → AI Assistant to keep going — it is faster and has no monthly limit from us.");

        if (countMessage) { _toCount = usage; _countedAgainst = platform; }

        var notice = new PlatformAiNoticeDto(true, usage.Messages, cap, false, false, platform.ShowOwnKeyBanner);
        return new ResolvedAi(providers.Create(platform.Provider), model!, key!, platform.Provider,
            null, null, null, null, true, notice);
    }

    public async Task<PlatformAiNoticeDto?> RecordMessageAsync(CancellationToken ct)
    {
        if (_toCount is null || _countedAgainst is null) return null;
        var usage = _toCount; var platform = _countedAgainst;
        _toCount = null; _countedAgainst = null;

        if (db.Entry(usage).State == EntityState.Detached) db.PlatformUsage.Add(usage);
        usage.AddMessage();
        await db.SaveChangesAsync(ct);

        var suggest = platform.NudgeEveryMessages > 0 && usage.Messages % platform.NudgeEveryMessages == 0;
        var cap = platform.MonthlyMessageCapPerTenant;
        return new PlatformAiNoticeDto(true, usage.Messages, cap, suggest, cap > 0 && usage.Messages >= cap, platform.ShowOwnKeyBanner);
    }

    public async Task<PlatformAiNoticeDto?> PeekNoticeAsync(CancellationToken ct)
    {
        var own = await db.AiSettings.AsNoTracking().FirstOrDefaultAsync(ct);
        var ownKey = own is null ? null : protector.Unprotect(own.ProtectedApiKey);
        if (!string.IsNullOrEmpty(ownKey)) return null;   // has a key of their own: nothing to say

        var platform = await db.PlatformAi.AsNoTracking().FirstOrDefaultAsync(ct);
        if (!PlatformReady(platform, out _, out _)) return null;

        var month = DateTime.UtcNow.ToString("yyyy-MM");
        var used = await db.PlatformUsage.AsNoTracking().Where(u => u.Month == month).Select(u => u.Messages).FirstOrDefaultAsync(ct);
        var cap = platform!.MonthlyMessageCapPerTenant;
        return new PlatformAiNoticeDto(true, used, cap, false, cap > 0 && used >= cap, platform.ShowOwnKeyBanner);
    }

    private bool PlatformReady(PlatformAiSettings? p, out string? key, out string? model)
    {
        key = null; model = null;
        if (p is null || !p.Enabled) return false;
        key = protector.Unprotect(p.ProtectedApiKey);
        model = ResolveModel(p.Provider, p.Model);
        return !string.IsNullOrEmpty(key) && model is not null;
    }

    private async Task<PlatformAiUsage> UsedAsync(CancellationToken ct)
    {
        var month = DateTime.UtcNow.ToString("yyyy-MM");
        var row = await db.PlatformUsage.FirstOrDefaultAsync(u => u.Month == month, ct);
        if (row is null)
        {
            row = new PlatformAiUsage(month);   // not tracked until a message is actually counted
        }
        return row;
    }

    public static string? ResolveModel(AiProvider provider, string? configuredModel)
    {
        if (!string.IsNullOrWhiteSpace(configuredModel)) return configuredModel.Trim();
        return provider switch
        {
            AiProvider.Claude     => "claude-opus-4-8",
            AiProvider.OpenRouter => null,   // the free catalogue changes too often for a safe default
            _                     => "openai/gpt-oss-120b",
        };
    }
}
