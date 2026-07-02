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

        settings.Configure(provider, cmd.Model, cmd.Tier, cmd.Enabled, cmd.VoiceEnabled, cmd.TelegramEnabled);

        if (cmd.ClearApiKey)
            settings.ClearApiKey();
        else if (!string.IsNullOrWhiteSpace(cmd.ApiKey))
            settings.SetProtectedApiKey(protector.Protect(cmd.ApiKey.Trim()));

        await db.SaveChangesAsync(ct);

        return new AiSettingsDto(
            settings.Provider.ToString(), settings.Model, settings.Enabled, settings.Tier,
            settings.VoiceEnabled, settings.TelegramEnabled, settings.HasApiKey);
    }
}
