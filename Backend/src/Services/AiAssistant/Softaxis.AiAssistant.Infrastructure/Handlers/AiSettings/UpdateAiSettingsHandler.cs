using Microsoft.EntityFrameworkCore;
using Softaxis.AiAssistant.Application.Abstractions;
using Softaxis.AiAssistant.Application.AiSettings.Commands;
using Softaxis.AiAssistant.Application.AiSettings.Dtos;
using Softaxis.AiAssistant.Domain.Entities;
using Softaxis.AiAssistant.Domain.Enums;
using Softaxis.AiAssistant.Infrastructure.Persistence;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;

namespace Softaxis.AiAssistant.Infrastructure.Handlers.AiSettings;

internal sealed class UpdateAiSettingsHandler(AiAssistantDbContext db, ISecretProtector protector)
    : ICommandHandler<UpdateAiSettingsCommand, AiSettingsDto>
{
    public async Task<Result<AiSettingsDto>> Handle(UpdateAiSettingsCommand cmd, CancellationToken ct)
    {
        if (!Enum.TryParse<AiProvider>(cmd.Provider, ignoreCase: true, out var provider))
            return Result.Failure<AiSettingsDto>(Error.Custom("AiSettings.InvalidProvider", $"Unknown provider '{cmd.Provider}'."));

        var settings = await db.AiSettings.FirstOrDefaultAsync(ct);
        if (settings is null)
        {
            settings = new TenantAiSettings(provider);
            db.AiSettings.Add(settings);
        }

        // Clamp premium feature toggles to what the chosen tier allows — a tenant can never enable a
        // feature above its plan (single source of truth: AiTierCapabilities).
        var caps = Domain.AiTierCapabilities.For(cmd.Tier);
        settings.Configure(provider, cmd.Model, cmd.Tier, cmd.Enabled,
            cmd.VoiceEnabled && caps.Voice, cmd.TelegramEnabled && caps.Telegram);

        if (cmd.ClearApiKey)
            settings.ClearApiKey();
        else if (!string.IsNullOrWhiteSpace(cmd.ApiKey))
            settings.SetProtectedApiKey(protector.Protect(cmd.ApiKey.Trim()));

        // Telegram bot config
        if (cmd.ClearTelegramBot)
            settings.ClearTelegramBot();
        else if (!string.IsNullOrWhiteSpace(cmd.TelegramBotToken) || cmd.TelegramBotUsername is not null)
            settings.ConfigureTelegramBot(
                string.IsNullOrWhiteSpace(cmd.TelegramBotToken) ? null : protector.Protect(cmd.TelegramBotToken.Trim()),
                cmd.TelegramBotUsername);

        // Fallback provider (BYO, optional) — empty FallbackProvider disables it.
        AiProvider? fallbackProvider = null;
        if (!string.IsNullOrWhiteSpace(cmd.FallbackProvider))
        {
            if (!Enum.TryParse<AiProvider>(cmd.FallbackProvider, ignoreCase: true, out var fp))
                return Result.Failure<AiSettingsDto>(Error.Custom("AiSettings.InvalidProvider", $"Unknown fallback provider '{cmd.FallbackProvider}'."));
            fallbackProvider = fp;
        }
        settings.ConfigureFallback(cmd.FallbackEnabled, fallbackProvider, cmd.FallbackModel);

        if (cmd.ClearFallbackApiKey)
            settings.ClearFallbackApiKey();
        else if (!string.IsNullOrWhiteSpace(cmd.FallbackApiKey))
            settings.SetFallbackProtectedApiKey(protector.Protect(cmd.FallbackApiKey.Trim()));

        await db.SaveChangesAsync(ct);

        return new AiSettingsDto(
            settings.Provider.ToString(), settings.Model, settings.Enabled, settings.Tier,
            settings.VoiceEnabled, settings.TelegramEnabled, settings.HasApiKey,
            settings.TelegramBotUsername, settings.HasTelegramBotToken, settings.TelegramInboundKey,
            Capabilities: AiCapabilitiesMapper.From(settings),
            FallbackEnabled: settings.FallbackEnabled,
            FallbackProvider: settings.FallbackProvider?.ToString(),
            FallbackModel: settings.FallbackModel,
            HasFallbackApiKey: settings.HasFallbackApiKey);
    }
}
