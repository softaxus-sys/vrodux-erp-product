using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Integrations.Queries;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Integrations.Meta;

internal sealed class GetMetaPagesHandler(CrmDbContext db)
    : IQueryHandler<GetMetaPagesQuery, IReadOnlyList<MetaPageDto>>
{
    public async Task<Result<IReadOnlyList<MetaPageDto>>> Handle(GetMetaPagesQuery query, CancellationToken ct)
    {
        var integration = await db.Integrations.AsNoTracking().Include(x => x.Resources)
            .FirstOrDefaultAsync(x => x.Id == query.IntegrationId && !x.IsDeleted, ct);
        if (integration is null)
            return Result.Failure<IReadOnlyList<MetaPageDto>>(Error.NotFoundById("Integration", query.IntegrationId));

        var pages = integration.Resources.Where(r => r.ResourceType == "page")
            .Select(r => new MetaPageDto(r.ExternalId, r.Name, r.Enabled)).ToList();
        return Result.Success<IReadOnlyList<MetaPageDto>>(pages);
    }
}
