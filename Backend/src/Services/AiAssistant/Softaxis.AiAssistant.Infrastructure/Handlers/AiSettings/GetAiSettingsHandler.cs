using Microsoft.EntityFrameworkCore;
using Softaxis.AiAssistant.Application.AiSettings.Dtos;
using Softaxis.AiAssistant.Application.AiSettings.Queries;
using Softaxis.AiAssistant.Domain.Enums;
using Softaxis.AiAssistant.Infrastructure.Persistence;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;

namespace Softaxis.AiAssistant.Infrastructure.Handlers.AiSettings;

internal sealed class GetAiSettingsHandler(AiAssistantDbContext db)
    : IQueryHandler<GetAiSettingsQuery, AiSettingsDto>
{
    public async Task<Result<AiSettingsDto>> Handle(GetAiSettingsQuery request, CancellationToken ct)
    {
        var s = await db.AiSettings.AsNoTracking().FirstOrDefaultAsync(ct);

        if (s is null)
            return new AiSettingsDto(nameof(AiProvider.Claude), null, false, "starter", false, false, false,
                Capabilities: AiCapabilitiesMapper.From(null));

        return new AiSettingsDto(
            s.Provider.ToString(), s.Model, s.Enabled, s.Tier, s.VoiceEnabled, s.TelegramEnabled, s.HasApiKey,
            s.TelegramBotUsername, s.HasTelegramBotToken, s.TelegramInboundKey,
            Capabilities: AiCapabilitiesMapper.From(s),
            FallbackProvider: s.FallbackProvider?.ToString(),
            FallbackModel: s.FallbackModel,
            HasFallbackApiKey: s.HasFallbackApiKey);
    }
}
