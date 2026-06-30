using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.CRM.Application.Integrations.Commands;
using Softaxis.CRM.Application.LeadIntake.Abstractions;
using Softaxis.CRM.Domain.Entities.Integrations;
using Softaxis.CRM.Infrastructure.Integrations.Providers.Meta;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Integrations.Meta;

/// <summary>
/// Anonymous OAuth callback (Facebook redirects the browser, no JWT). Resolves the integration
/// from the encrypted state with the tenant filter bypassed, exchanges the code, stores the
/// long-lived token + discovered pages (encrypted), all stamped with the integration's tenant.
/// </summary>
internal sealed class MetaOAuthCallbackHandler(
    CrmDbContext db, ILeadProviderRegistry registry, MetaGraphClient graph, ISecretProtector protector)
    : ICommandHandler<MetaOAuthCallbackCommand, MetaCallbackResult>
{
    public async Task<Result<MetaCallbackResult>> Handle(MetaOAuthCallbackCommand cmd, CancellationToken ct)
    {
        if (!Guid.TryParse(protector.Unprotect(cmd.State), out var integrationId))
            return Result.Failure<MetaCallbackResult>(Error.Custom("Integration.InvalidState", "Invalid OAuth state."));

        var integration = await db.Integrations.Include(x => x.Resources)
            .FirstOrDefaultAsync(x => x.Id == integrationId && !x.IsDeleted, ct);
        if (integration is null)
            return Result.Failure<MetaCallbackResult>(Error.NotFoundById("Integration", integrationId));

        if (registry.Find(integration.ProviderKey) is not IOAuthLeadProvider provider)
            return Result.Failure<MetaCallbackResult>(Error.Custom("Integration.Conflict", "Not an OAuth integration."));

        var tenantId = (Guid?)db.Entry(integration).Property(TenantIsolation.Column).CurrentValue;

        var tokens = await provider.ExchangeCodeAsync(cmd.Code, cmd.RedirectUri, ct);
        integration.SetCredentials(protector.Protect(JsonSerializer.Serialize(new
        {
            userToken = tokens.AccessToken, expiresAt = tokens.ExpiresAt, accountName = tokens.AccountName,
        })));

        // Refresh the page list (store each page's access token encrypted).
        var existingPages = integration.Resources.Where(r => r.ResourceType == "page").ToList();
        db.IntegrationResources.RemoveRange(existingPages);

        var pages = await graph.GetPagesAsync(tokens.AccessToken, ct);
        foreach (var p in pages)
        {
            var res = new IntegrationResource(integration.Id, "page", p.Id, p.Name);
            res.SetEnabled(false);
            res.SetAccessToken(protector.Protect(p.AccessToken));
            if (tenantId is not null) db.Entry(res).Property(TenantIsolation.Column).CurrentValue = tenantId;
            db.IntegrationResources.Add(res);
        }

        await db.SaveChangesAsync(ct);
        return Result.Success(new MetaCallbackResult(integration.Id));
    }
}
