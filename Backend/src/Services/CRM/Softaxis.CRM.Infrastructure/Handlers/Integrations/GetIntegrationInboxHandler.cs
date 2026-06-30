using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Integrations.Dtos;
using Softaxis.CRM.Application.Integrations.Queries;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Integrations;

internal sealed class GetIntegrationInboxHandler(CrmDbContext db)
    : IQueryHandler<GetIntegrationInboxQuery, IReadOnlyList<RawLeadInboxDto>>
{
    public async Task<Result<IReadOnlyList<RawLeadInboxDto>>> Handle(GetIntegrationInboxQuery query, CancellationToken ct)
    {
        var q = db.RawLeadInbox.AsNoTracking().Where(x => x.IntegrationId == query.IntegrationId);
        if (!string.IsNullOrWhiteSpace(query.Status))
            q = q.Where(x => x.Status == query.Status);

        var items = await q.OrderByDescending(x => x.ReceivedAt).Take(200).ToListAsync(ct);
        return Result.Success<IReadOnlyList<RawLeadInboxDto>>(items.Select(IntegrationMappings.ToDto).ToList());
    }
}
