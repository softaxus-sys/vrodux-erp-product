using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Integrations.Commands;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Integrations;

internal sealed class DeleteIntegrationHandler(CrmDbContext db)
    : ICommandHandler<DeleteIntegrationCommand>
{
    public async Task<Result> Handle(DeleteIntegrationCommand cmd, CancellationToken ct)
    {
        var integration = await db.Integrations.FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (integration is null)
            return Result.Failure(Error.NotFoundById("Integration", cmd.Id));

        integration.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
