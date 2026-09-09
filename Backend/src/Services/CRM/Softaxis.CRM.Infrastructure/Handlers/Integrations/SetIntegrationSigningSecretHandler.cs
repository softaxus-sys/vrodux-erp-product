using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Integrations.Commands;
using Softaxis.CRM.Application.LeadIntake.Abstractions;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Integrations;

internal sealed class SetIntegrationSigningSecretHandler(CrmDbContext db, ISecretProtector protector)
    : ICommandHandler<SetIntegrationSigningSecretCommand>
{
    public async Task<Result> Handle(SetIntegrationSigningSecretCommand cmd, CancellationToken ct)
    {
        var integration = await db.Integrations.FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (integration is null)
            return Result.Failure(Error.NotFoundById("Integration", cmd.Id));

        // Replaces the secret generated at creation. That one was only ever a placeholder for a
        // provider that lets us choose; where the provider issues the key, theirs is the only value
        // that can verify anything.
        integration.SetSigningSecret(protector.Protect(cmd.Secret.Trim()));

        // Every integration is born with a generated signing secret, so "SigningSecret is not null"
        // says nothing about whether the PROVIDER's key has been entered. This marker is what the
        // UI reads; the secret itself is never duplicated here.
        integration.SetCredentials(protector.Protect(
            IntegrationCredentials.With(protector.Unprotect(integration.Credentials),
                IntegrationCredentials.ProviderSigningSecretField, "true")));

        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
