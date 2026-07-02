using Microsoft.EntityFrameworkCore;
using Softaxis.AiAssistant.Application.AiSettings.Dtos;
using Softaxis.AiAssistant.Application.AiSettings.Queries;
using Softaxis.AiAssistant.Infrastructure.Persistence;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;

namespace Softaxis.AiAssistant.Infrastructure.Handlers.AiSettings;

internal sealed class GetAiCapabilitiesHandler(AiAssistantDbContext db)
    : IQueryHandler<GetAiCapabilitiesQuery, AiCapabilitiesDto>
{
    public async Task<Result<AiCapabilitiesDto>> Handle(GetAiCapabilitiesQuery request, CancellationToken ct)
    {
        var s = await db.AiSettings.AsNoTracking().FirstOrDefaultAsync(ct);
        return Result.Success(AiCapabilitiesMapper.From(s));
    }
}
