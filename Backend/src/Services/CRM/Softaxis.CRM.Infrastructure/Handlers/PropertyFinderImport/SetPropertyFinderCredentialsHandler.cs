using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.PropertyFinderImport.Commands;
using Softaxis.CRM.Infrastructure.Integrations.Providers.PropertyFinder;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.PropertyFinderImport;

internal sealed class SetPropertyFinderCredentialsHandler(
    PropertyFinderApiClient api,
    PropertyFinderCredentialStore store,
    CrmDbContext db) : ICommandHandler<SetPropertyFinderCredentialsCommand>
{
    public async Task<Result> Handle(SetPropertyFinderCredentialsCommand cmd, CancellationToken ct)
    {
        // The DbContext is tenant-filtered, so this can only ever reach the caller's own row.
        var integration = await db.Integrations
            .FirstOrDefaultAsync(x => x.Id == cmd.IntegrationId && !x.IsDeleted, ct);
        if (integration is null)
            return Result.Failure(Error.NotFoundById("Integration", cmd.IntegrationId));

        var cred = PropertyFinderApiClient.BuildCredentials(cmd.ApiKey, cmd.ApiSecret);
        if (cred is null)
            return Result.Failure(Error.Custom("PropertyFinder.Invalid", "Both an API key and a secret are required."));

        // Prove the pair works before storing it. Saving an unverified key produces an integration
        // that reads as connected and only fails later, mid-import.
        try
        {
            await api.GetRolesAsync(cred, ct);
        }
        catch (PropertyFinderScopeException)
        {
            // The key authenticated but lacks roles:read. That is a scope problem to raise on the
            // import screen, not a reason to reject a valid key.
        }
        catch (PropertyFinderAuthException ex)
        {
            return Result.Failure(Error.Custom("PropertyFinder.Unauthorized",
                $"Property Finder rejected this key. {ex.Message}"));
        }
        catch (PropertyFinderApiException ex)
        {
            return Result.Failure(Error.Custom("PropertyFinder.Failed", ex.Message));
        }

        store.Write(integration, cmd.ApiKey, cmd.ApiSecret);
        integration.MarkConnected();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
