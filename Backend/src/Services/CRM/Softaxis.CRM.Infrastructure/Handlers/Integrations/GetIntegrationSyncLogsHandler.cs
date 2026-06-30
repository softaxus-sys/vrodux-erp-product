using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Integrations.Dtos;
using Softaxis.CRM.Application.Integrations.Queries;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Integrations;

internal sealed class GetIntegrationSyncLogsHandler(CrmDbContext db)
    : IQueryHandler<GetIntegrationSyncLogsQuery, IReadOnlyList<IntegrationSyncLogDto>>
{
    public async Task<Result<IReadOnlyList<IntegrationSyncLogDto>>> Handle(GetIntegrationSyncLogsQuery query, CancellationToken ct)
    {
        var items = await db.IntegrationSyncLogs.AsNoTracking()
            .Where(x => x.IntegrationId == query.IntegrationId)
            .OrderByDescending(x => x.StartedAt)
            .Take(200)
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<IntegrationSyncLogDto>>(items.Select(IntegrationMappings.ToDto).ToList());
    }
}
