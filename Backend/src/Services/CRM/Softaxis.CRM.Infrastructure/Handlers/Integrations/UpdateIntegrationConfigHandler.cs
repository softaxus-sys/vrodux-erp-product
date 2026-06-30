using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Integrations.Commands;
using Softaxis.CRM.Domain.Entities.Integrations;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Integrations;

internal sealed class UpdateIntegrationConfigHandler(CrmDbContext db)
    : ICommandHandler<UpdateIntegrationConfigCommand>
{
    public async Task<Result> Handle(UpdateIntegrationConfigCommand cmd, CancellationToken ct)
    {
        var integration = await db.Integrations
            .Include(x => x.FieldMappings)
            .FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (integration is null)
            return Result.Failure(Error.NotFoundById("Integration", cmd.Id));

        if (cmd.Config is not null)        integration.SetConfig(cmd.Config);
        if (cmd.DedupeConfig is not null)  integration.SetDedupeConfig(cmd.DedupeConfig);
        if (cmd.RoutingConfig is not null) integration.SetRoutingConfig(cmd.RoutingConfig);

        if (cmd.FieldMappings is not null)
        {
            db.IntegrationFieldMappings.RemoveRange(integration.FieldMappings);
            integration.FieldMappings.Clear();
            foreach (var m in cmd.FieldMappings)
            {
                if (string.IsNullOrWhiteSpace(m.SourceField) || string.IsNullOrWhiteSpace(m.TargetField)) continue;
                integration.FieldMappings.Add(new FieldMapping(integration.Id, m.SourceField, m.TargetField));
            }
        }

        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
