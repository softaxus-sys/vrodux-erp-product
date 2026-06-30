using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Integrations.Commands;
using Softaxis.CRM.Application.LeadIntake.Abstractions;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Integrations.Meta;

internal sealed class StartMetaOAuthHandler(CrmDbContext db, ILeadProviderRegistry registry, ISecretProtector protector)
    : ICommandHandler<StartMetaOAuthCommand, MetaOAuthUrl>
{
    public async Task<Result<MetaOAuthUrl>> Handle(StartMetaOAuthCommand cmd, CancellationToken ct)
    {
        var integration = await db.Integrations.FirstOrDefaultAsync(x => x.Id == cmd.IntegrationId && !x.IsDeleted, ct);
        if (integration is null)
            return Result.Failure<MetaOAuthUrl>(Error.NotFoundById("Integration", cmd.IntegrationId));

        if (registry.Find(integration.ProviderKey) is not IOAuthLeadProvider provider)
            return Result.Failure<MetaOAuthUrl>(Error.Custom("Integration.Conflict", "This integration does not use OAuth."));

        // State carries the (encrypted) integration id so the anonymous callback can resolve it.
        var state = Uri.EscapeDataString(protector.Protect(integration.Id.ToString())!);
        return Result.Success(new MetaOAuthUrl(provider.BuildAuthorizationUrl(cmd.RedirectUri, state)));
    }
}
