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

        // Stored encrypted as a small JSON envelope so future providers can add fields.
        var envelope = System.Text.Json.JsonSerializer.Serialize(new { apiKey = cmd.ApiKey });
        integration.SetCredentials(protector.Protect(envelope));
        integration.MarkConnected();

        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
