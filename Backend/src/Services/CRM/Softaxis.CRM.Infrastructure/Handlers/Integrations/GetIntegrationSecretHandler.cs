using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Integrations.Dtos;
using Softaxis.CRM.Application.Integrations.Queries;
using Softaxis.CRM.Application.LeadIntake.Abstractions;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Integrations;

internal sealed class GetIntegrationSecretHandler(CrmDbContext db, ISecretProtector protector, IConfiguration config)
    : IQueryHandler<GetIntegrationSecretQuery, IntegrationSecretDto>
{
    public async Task<Result<IntegrationSecretDto>> Handle(GetIntegrationSecretQuery query, CancellationToken ct)
    {
        var i = await db.Integrations.AsNoTracking().FirstOrDefaultAsync(x => x.Id == query.Id && !x.IsDeleted, ct);
        if (i is null)
            return Result.Failure<IntegrationSecretDto>(Error.NotFoundById("Integration", query.Id));

        return Result.Success(new IntegrationSecretDto(
            IntegrationMappings.BuildInboundUrl(config["Integrations:PublicBaseUrl"], i.InboundKey),
            protector.Unprotect(i.SigningSecret)));
    }
}
