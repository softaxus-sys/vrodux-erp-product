using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Integrations.Dtos;
using Softaxis.CRM.Application.Integrations.Queries;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Integrations;

internal sealed class GetIntegrationByIdHandler(CrmDbContext db, IConfiguration config)
    : IQueryHandler<GetIntegrationByIdQuery, IntegrationDto>
{
    public async Task<Result<IntegrationDto>> Handle(GetIntegrationByIdQuery query, CancellationToken ct)
    {
        var i = await db.Integrations.AsNoTracking()
            .Include(x => x.FieldMappings)
            .Include(x => x.Resources)
            .FirstOrDefaultAsync(x => x.Id == query.Id && !x.IsDeleted, ct);

        return i is null
            ? Result.Failure<IntegrationDto>(Error.NotFoundById("Integration", query.Id))
            : Result.Success(IntegrationMappings.ToDto(i, config["Integrations:PublicBaseUrl"]));
    }
}
