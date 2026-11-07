using Microsoft.EntityFrameworkCore;
using Softaxis.AiAssistant.Application.AiSettings.Dtos;
using Softaxis.AiAssistant.Application.AiSettings.Queries;
using Softaxis.AiAssistant.Infrastructure.Persistence;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;

namespace Softaxis.AiAssistant.Infrastructure.Handlers.AiSettings;

internal sealed class GetAiCapabilitiesHandler(AiAssistantDbContext db, Orchestration.IAiKeyResolver keys)
    : IQueryHandler<GetAiCapabilitiesQuery, AiCapabilitiesDto>
{
    public async Task<Result<AiCapabilitiesDto>> Handle(GetAiCapabilitiesQuery request, CancellationToken ct)
    {
        var s = await db.AiSettings.AsNoTracking().FirstOrDefaultAsync(ct);
        var caps = AiCapabilitiesMapper.From(s);

        // A workspace served by the shared platform AI has the assistant available even though it
        // never switched it on itself. The notice also tells every user (not only admins, who alone
        // can read the settings) that the shared AI is in use and how much of it is left.
        var notice = await keys.PeekNoticeAsync(ct);
        if (notice is not null) caps = caps with { AiEnabled = true, PlatformAi = notice };
        return Result.Success(caps);
    }
}
