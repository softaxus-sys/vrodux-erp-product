using Microsoft.Extensions.Options;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Integrations.Queries;
using Softaxis.CRM.Infrastructure.Integrations.Providers.Meta;

namespace Softaxis.CRM.Infrastructure.Handlers.Integrations.Meta;

/// <summary>App-level Meta webhook verification: echo hub.challenge when the verify token matches.</summary>
internal sealed class VerifyMetaWebhookHandler(IOptions<MetaOptions> options)
    : IQueryHandler<VerifyMetaWebhookQuery, string>
{
    private readonly MetaOptions _o = options.Value;

    public Task<Result<string>> Handle(VerifyMetaWebhookQuery query, CancellationToken ct)
    {
        var q = query.Query;
        if (q.TryGetValue("hub.mode", out var mode) && mode == "subscribe"
            && q.TryGetValue("hub.verify_token", out var token) && token == _o.VerifyToken
            && q.TryGetValue("hub.challenge", out var challenge))
            return Task.FromResult(Result.Success(challenge));

        return Task.FromResult(Result.Failure<string>(Error.Custom("Webhook.Unauthorized", "Verification failed.")));
    }
}
