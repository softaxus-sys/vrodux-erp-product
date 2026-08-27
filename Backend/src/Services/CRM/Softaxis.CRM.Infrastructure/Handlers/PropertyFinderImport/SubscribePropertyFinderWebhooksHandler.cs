using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.LeadIntake.Abstractions;
using Softaxis.CRM.Application.PropertyFinderImport.Commands;
using Softaxis.CRM.Application.PropertyFinderImport.Dtos;
using Softaxis.CRM.Infrastructure.Handlers.Integrations;
using Softaxis.CRM.Infrastructure.Integrations.Providers.PropertyFinder;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.PropertyFinderImport;

internal sealed class SubscribePropertyFinderWebhooksHandler(
    PropertyFinderApiClient api,
    PropertyFinderCredentialStore credentials,
    CrmDbContext db,
    ISecretProtector protector,
    IConfiguration config)
    : ICommandHandler<SubscribePropertyFinderWebhooksCommand, PfWebhookStatusDto>
{
    /// <summary>
    /// <c>lead.created</c> brings new enquiries; <c>lead.assigned</c> keeps ownership in step when
    /// Property Finder moves a lead between agents.
    /// </summary>
    private static readonly string[] WantedEvents = ["lead.created", "lead.assigned"];

    public async Task<Result<PfWebhookStatusDto>> Handle(
        SubscribePropertyFinderWebhooksCommand cmd, CancellationToken ct)
    {
        var integration = await db.Integrations
            .FirstOrDefaultAsync(x => x.Id == cmd.IntegrationId && !x.IsDeleted, ct);
        if (integration is null)
            return Result.Failure<PfWebhookStatusDto>(Error.NotFoundById("Integration", cmd.IntegrationId));

        // Credentials come off this very integration, so a tenant can only ever subscribe using
        // its own Property Finder account.
        var cred = credentials.Read(integration);
        if (cred is null)
            return Result.Failure<PfWebhookStatusDto>(Error.Custom(
                "PropertyFinder.NotConfigured",
                "This integration has no Property Finder API key yet. Enter the agency's key and secret first."));

        var callbackUrl = IntegrationMappings.BuildInboundUrl(
            config["Integrations:PublicBaseUrl"], integration.InboundKey);

        // Property Finder calls US, so the URL has to be reachable from the public internet. A
        // localhost or relative URL would be accepted by their API and then silently never fire —
        // far worse than refusing here, because it looks connected.
        if (UnreachableReason(callbackUrl) is { } blocker)
            return Result.Success(new PfWebhookStatusDto(
                callbackUrl, Live: false, Blocker: blocker,
                Subscriptions: [], MissingEvents: WantedEvents, Notes: []));

        var notes = new List<string>();

        // Property Finder caps the webhook secret at 32 characters. The integration's default
        // signing secret is Base64 of 32 bytes — 44 characters — which their API rejects outright,
        // so a compatible one is issued before the first subscribe.
        var secret = integration.SigningSecret is { } stored ? protector.Unprotect(stored) : null;
        if (string.IsNullOrWhiteSpace(secret) || secret.Length > 32)
        {
            secret = RandomNumberGenerator.GetHexString(32, lowercase: true);
            integration.SetSigningSecret(protector.Protect(secret));
            await db.SaveChangesAsync(ct);
            notes.Add("Issued a Property Finder-compatible signing secret (their limit is 32 characters).");
        }

        List<PfWebhookDto> existing;
        try
        {
            existing = (await api.ListWebhooksAsync(cred, ct)).Select(ToDto(callbackUrl)).ToList();
        }
        catch (PropertyFinderApiException ex)
        {
            integration.RecordSyncFailure(ex.Message);
            await db.SaveChangesAsync(ct);
            return Result.Failure<PfWebhookStatusDto>(Error.Custom("PropertyFinder.Failed", ex.Message));
        }

        foreach (var eventId in WantedEvents)
        {
            // Several subscriptions may exist per event, so a match must be on OUR url too —
            // otherwise a subscription belonging to another system would be read as ours, and
            // re-subscribing would deliver every lead twice.
            if (existing.Any(w => w.EventId == eventId && w.IsOurs)) continue;

            try
            {
                await api.SubscribeAsync(cred, eventId, callbackUrl, secret, ct);
            }
            catch (PropertyFinderApiException ex)
            {
                integration.RecordSyncFailure(ex.Message);
                await db.SaveChangesAsync(ct);
                return Result.Failure<PfWebhookStatusDto>(Error.Custom("PropertyFinder.Failed",
                    $"Could not subscribe to '{eventId}'. {ex.Message}"));
            }
        }

        // Read back rather than assume: the only trustworthy answer to "are we live?" is what
        // Property Finder itself now reports.
        try
        {
            existing = (await api.ListWebhooksAsync(cred, ct)).Select(ToDto(callbackUrl)).ToList();
        }
        catch (PropertyFinderApiException) { /* keep what we had */ }

        var missing = WantedEvents.Where(e => !existing.Any(w => w.EventId == e && w.IsOurs)).ToList();

        var foreign = existing.Where(w => WantedEvents.Contains(w.EventId) && !w.IsOurs).ToList();
        if (foreign.Count > 0)
            notes.Add($"{foreign.Count} subscription(s) for these events point elsewhere and were left untouched — " +
                      "Property Finder allows several per event, and removing one could break another system.");

        integration.MarkConnected();
        integration.RecordSyncSuccess();
        await db.SaveChangesAsync(ct);

        return Result.Success(new PfWebhookStatusDto(
            callbackUrl,
            Live: missing.Count == 0,
            Blocker: null,
            Subscriptions: existing,
            MissingEvents: missing,
            Notes: notes));
    }

    private static Func<JsonElement, PfWebhookDto> ToDto(string ourUrl) => el => new PfWebhookDto(
        EventId:   el.TryGetProperty("eventId", out var e) ? e.GetString() ?? "" : "",
        Url:       el.TryGetProperty("url", out var u) ? u.GetString() ?? "" : "",
        CreatedAt: el.TryGetProperty("createdAt", out var c) ? c.GetString() : null,
        IsOurs:    el.TryGetProperty("url", out var u2) &&
                   string.Equals(u2.GetString()?.TrimEnd('/'), ourUrl.TrimEnd('/'), StringComparison.OrdinalIgnoreCase));

    /// <summary>Why Property Finder could not call this URL — null when it looks reachable.</summary>
    private static string? UnreachableReason(string callbackUrl)
    {
        if (!Uri.TryCreate(callbackUrl, UriKind.Absolute, out var uri))
            return "No public base URL is configured. Set Integrations:PublicBaseUrl to the address " +
                   "Property Finder should call, then subscribe again.";

        if (uri.IsLoopback || uri.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase))
            return $"{uri.Host} is only reachable from this machine, so Property Finder can never " +
                   "deliver to it. Use a public HTTPS address (or a tunnel while developing).";

        if (uri.Scheme != Uri.UriSchemeHttps)
            return "Property Finder delivers over HTTPS only — the callback URL must not be plain HTTP.";

        return null;
    }
}
