using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Integrations.Dtos;
using Softaxis.CRM.Application.Integrations.Queries;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Integrations;

internal sealed class GetIntegrationsHandler(CrmDbContext db, IConfiguration config)
    : IQueryHandler<GetIntegrationsQuery, IReadOnlyList<IntegrationDto>>
{
    public async Task<Result<IReadOnlyList<IntegrationDto>>> Handle(GetIntegrationsQuery query, CancellationToken ct)
    {
        var baseUrl = config["Integrations:PublicBaseUrl"];
        var items = await db.Integrations.AsNoTracking()
            .Include(x => x.FieldMappings)
            .Include(x => x.Resources)
            .Where(x => !x.IsDeleted)
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<IntegrationDto>>(
            items.Select(i => IntegrationMappings.ToDto(i, baseUrl)).ToList());
    }
}
