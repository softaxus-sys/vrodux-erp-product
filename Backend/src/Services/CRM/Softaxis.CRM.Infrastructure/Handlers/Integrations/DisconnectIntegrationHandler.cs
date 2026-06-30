using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Integrations.Commands;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Integrations;

internal sealed class DisconnectIntegrationHandler(CrmDbContext db)
    : ICommandHandler<DisconnectIntegrationCommand>
{
    public async Task<Result> Handle(DisconnectIntegrationCommand cmd, CancellationToken ct)
    {
        var integration = await db.Integrations.FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (integration is null)
            return Result.Failure(Error.NotFoundById("Integration", cmd.Id));

        integration.MarkDisconnected();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
