using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Integrations.Commands;
using Softaxis.CRM.Application.Integrations.Dtos;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Integrations;

internal sealed class RotateInboundKeyHandler(CrmDbContext db, IConfiguration config)
    : ICommandHandler<RotateInboundKeyCommand, IntegrationDto>
{
    public async Task<Result<IntegrationDto>> Handle(RotateInboundKeyCommand cmd, CancellationToken ct)
    {
        var integration = await db.Integrations
            .Include(x => x.FieldMappings)
            .Include(x => x.Resources)
            .FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (integration is null)
            return Result.Failure<IntegrationDto>(Error.NotFoundById("Integration", cmd.Id));

        integration.RotateInboundKey();
        await db.SaveChangesAsync(ct);

        return Result.Success(IntegrationMappings.ToDto(integration, config["Integrations:PublicBaseUrl"]));
    }
}
