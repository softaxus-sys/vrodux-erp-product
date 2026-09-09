using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Integrations.Commands;
using Softaxis.CRM.Application.LeadIntake.Abstractions;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Integrations;

internal sealed class SetIntegrationApiKeyHandler(CrmDbContext db, ISecretProtector protector)
    : ICommandHandler<SetIntegrationApiKeyCommand>
{
    public async Task<Result> Handle(SetIntegrationApiKeyCommand cmd, CancellationToken ct)
    {
        var integration = await db.Integrations.FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (integration is null)
            return Result.Failure(Error.NotFoundById("Integration", cmd.Id));

        // Merged into the existing envelope rather than replacing it: a provider can hold more
        // than one credential (Bayut keeps a pull key beside a marker for its push secret), and
        // overwriting wholesale would silently drop whichever was saved first.
        integration.SetCredentials(protector.Protect(
            IntegrationCredentials.With(protector.Unprotect(integration.Credentials), "apiKey", cmd.ApiKey)));
        integration.MarkConnected();

        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
