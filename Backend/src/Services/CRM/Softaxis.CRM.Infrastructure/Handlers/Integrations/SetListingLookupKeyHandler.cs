using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Integrations.Commands;
using Softaxis.CRM.Application.LeadIntake.Abstractions;
using Softaxis.CRM.Infrastructure.Integrations.Providers.PropertyPortals;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Integrations;

internal sealed class SetListingLookupKeyHandler(CrmDbContext db, ISecretProtector protector)
    : ICommandHandler<SetListingLookupKeyCommand>
{
    public async Task<Result> Handle(SetListingLookupKeyCommand cmd, CancellationToken ct)
    {
        var integration = await db.Integrations.FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (integration is null)
            return Result.Failure(Error.NotFoundById("Integration", cmd.Id));

        // Merged into the existing envelope: this sits beside the pull key and the push secret, and
        // replacing it wholesale would drop whichever was saved first.
        var envelope = protector.Unprotect(integration.Credentials);
        var key = cmd.ApiKey?.Trim();
        envelope = string.IsNullOrEmpty(key)
            ? IntegrationCredentials.Without(envelope, BayutListingAgentDirectory.ApiKeyField)
            : IntegrationCredentials.With(envelope, BayutListingAgentDirectory.ApiKeyField, key);
        if (!string.IsNullOrWhiteSpace(cmd.BaseUrl))
            envelope = IntegrationCredentials.With(envelope,
                BayutListingAgentDirectory.BaseUrlField, cmd.BaseUrl.Trim());

        integration.SetCredentials(protector.Protect(envelope));
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
