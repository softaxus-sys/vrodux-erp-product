using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Integrations.Queries;
using Softaxis.CRM.Application.LeadIntake.Abstractions;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Integrations;

/// <summary>Provider GET handshake (e.g. Meta hub.challenge). Returns the echo string or empty.</summary>
internal sealed class VerifyWebhookHandler(CrmDbContext db, ILeadProviderRegistry registry)
    : IQueryHandler<VerifyWebhookQuery, string>
{
    public async Task<Result<string>> Handle(VerifyWebhookQuery query, CancellationToken ct)
    {
        var integration = await db.Integrations
            .FirstOrDefaultAsync(x => x.InboundKey == query.InboundKey && !x.IsDeleted, ct);
        if (integration is null)
            return Result.Failure<string>(Error.Custom("Webhook.NotFound", "Unknown inbound key."));

        var challenge = registry.Find(integration.ProviderKey) is IWebhookLeadProvider provider
            ? provider.TryHandleVerification(query.Query, integration)
            : null;

        return Result.Success(challenge ?? string.Empty);
    }
}
