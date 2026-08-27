using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.PropertyFinderImport.Dtos;
using Softaxis.CRM.Application.PropertyFinderImport.Queries;
using Softaxis.CRM.Infrastructure.Handlers.Integrations;
using Softaxis.CRM.Infrastructure.Integrations.Providers.PropertyFinder;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.PropertyFinderImport;

/// <summary>
/// Reports whether new enquiries will arrive on their own, by asking Property Finder what it
/// actually holds — not by trusting a flag we set when we last tried to subscribe.
/// </summary>
internal sealed class GetPropertyFinderWebhooksHandler(
    PropertyFinderApiClient api,
    PropertyFinderCredentialStore credentials,
    CrmDbContext db,
    IConfiguration config)
    : IQueryHandler<GetPropertyFinderWebhooksQuery, PfWebhookStatusDto>
{
    private static readonly string[] WantedEvents = ["lead.created", "lead.assigned"];

    public async Task<Result<PfWebhookStatusDto>> Handle(GetPropertyFinderWebhooksQuery q, CancellationToken ct)
    {
        var integration = await db.Integrations.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == q.IntegrationId && !x.IsDeleted, ct);
        if (integration is null)
            return Result.Failure<PfWebhookStatusDto>(Error.NotFoundById("Integration", q.IntegrationId));

        var cred = credentials.Read(integration);
        if (cred is null)
            return Result.Failure<PfWebhookStatusDto>(Error.Custom(
                "PropertyFinder.NotConfigured",
                "This integration has no Property Finder API key yet. Enter the agency's key and secret first."));

        var callbackUrl = IntegrationMappings.BuildInboundUrl(
            config["Integrations:PublicBaseUrl"], integration.InboundKey);

        List<PfWebhookDto> subs;
        try
        {
            subs = (await api.ListWebhooksAsync(cred, ct)).Select(el => new PfWebhookDto(
                EventId:   el.TryGetProperty("eventId", out var e) ? e.GetString() ?? "" : "",
                Url:       el.TryGetProperty("url", out var u) ? u.GetString() ?? "" : "",
                CreatedAt: el.TryGetProperty("createdAt", out var c) ? c.GetString() : null,
                IsOurs:    el.TryGetProperty("url", out var u2) &&
                           string.Equals(u2.GetString()?.TrimEnd('/'), callbackUrl.TrimEnd('/'),
                                         StringComparison.OrdinalIgnoreCase))).ToList();
        }
        catch (PropertyFinderApiException ex)
        {
            return Result.Failure<PfWebhookStatusDto>(Error.Custom("PropertyFinder.Failed", ex.Message));
        }

        var missing = WantedEvents.Where(e => !subs.Any(w => w.EventId == e && w.IsOurs)).ToList();

        return Result.Success(new PfWebhookStatusDto(
            callbackUrl,
            Live: missing.Count == 0,
            Blocker: null,
            Subscriptions: subs,
            MissingEvents: missing,
            Notes: []));
    }
}
