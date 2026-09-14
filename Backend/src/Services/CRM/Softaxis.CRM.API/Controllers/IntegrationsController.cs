using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.CRM.API.Authorization;
using Softaxis.CRM.API.Controllers.Common;
using Softaxis.CRM.Application.Integrations.Commands;
using Softaxis.CRM.Application.Integrations.Queries;

namespace Softaxis.CRM.API.Controllers;

/// <summary>
/// Manage a tenant's lead-source integrations (Settings → Integrations). All actions are
/// permission-gated via <c>settings.integrations.*</c> and tenant-scoped automatically.
/// </summary>
[ApiController]
[Route("api/crm/integrations")]
[Authorize]
public sealed class IntegrationsController(ISender sender) : CrmControllerBase
{
    /// <summary>Provider catalog merged with this tenant's connection status (the cards grid).</summary>
    [HttpGet("catalog")]
    [RequirePermission("settings.integrations.view")]
    public async Task<IActionResult> GetCatalog(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetProviderCatalogQuery(), ct));

    [HttpGet]
    [RequirePermission("settings.integrations.view")]
    public async Task<IActionResult> GetAll(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetIntegrationsQuery(), ct));

    [HttpGet("{id:guid}")]
    [RequirePermission("settings.integrations.view")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetIntegrationByIdQuery(id), ct));

    [HttpGet("{id:guid}/sync-logs")]
    [RequirePermission("settings.integrations.view")]
    public async Task<IActionResult> GetSyncLogs(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetIntegrationSyncLogsQuery(id), ct));

    [HttpGet("{id:guid}/inbox")]
    [RequirePermission("settings.integrations.view")]
    public async Task<IActionResult> GetInbox(Guid id, [FromQuery] string? status, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetIntegrationInboxQuery(id, status), ct));

    // ── Lead Inbox (tenant-wide) ────────────────────────────────────────────
    // Routes sit under /inbox rather than /{id}/inbox so they are not shadowed by the
    // {id:guid} routes above, and so the page has one address independent of any integration.

    /// <summary>Every inbound delivery across all integrations, newest first (the Lead Inbox page).</summary>
    [HttpGet("inbox")]
    [RequirePermission("settings.integrations.view")]
    public async Task<IActionResult> GetLeadInbox(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 25,
        [FromQuery] Guid? integrationId = null, [FromQuery] string? provider = null,
        [FromQuery] string? status = null, [FromQuery] string? search = null,
        CancellationToken ct = default) =>
        OkOrError(await sender.Send(new GetLeadInboxQuery(page, pageSize, integrationId, provider, status, search), ct));

    /// <summary>Per-status and per-provider counts over the whole inbox.</summary>
    [HttpGet("inbox/summary")]
    [RequirePermission("settings.integrations.view")]
    public async Task<IActionResult> GetLeadInboxSummary(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetLeadInboxSummaryQuery(), ct));

    /// <summary>One delivery, including the raw payload exactly as the provider sent it.</summary>
    [HttpGet("inbox/{entryId:guid}")]
    [RequirePermission("settings.integrations.view")]
    public async Task<IActionResult> GetLeadInboxEntry(Guid entryId, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetLeadInboxEntryQuery(entryId), ct));

    /// <summary>Re-queue a failed delivery. Edit rather than view — it creates a lead.</summary>
    [HttpPost("inbox/{entryId:guid}/retry")]
    [RequirePermission("settings.integrations.edit")]
    public async Task<IActionResult> RetryLeadInboxEntry(Guid entryId, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new RetryLeadInboxEntryCommand(entryId), ct));

    // ── Assignment backfill ─────────────────────────────────────────────────
    // Leads this integration created BEFORE the portal agent rules existed keep whatever owner
    // they were given at the time. These two endpoints re-run the live rules over them.

    /// <summary>What a backfill would do. Read-only; nothing is assigned.</summary>
    [HttpGet("{id:guid}/assignment-backfill")]
    [RequirePermission("settings.integrations.view")]
    public async Task<IActionResult> PreviewAssignmentBackfill(
        Guid id, [FromQuery] bool includeAssigned = false, CancellationToken ct = default) =>
        OkOrError(await sender.Send(new PreviewLeadAssignmentBackfillQuery(id, includeAssigned), ct));

    /// <summary>Assign the leads named in the body. Edit — it rewrites who owns a record.</summary>
    [HttpPost("{id:guid}/assignment-backfill")]
    [RequirePermission("settings.integrations.edit")]
    public async Task<IActionResult> ApplyAssignmentBackfill(
        Guid id, [FromBody] AssignmentBackfillRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new ApplyLeadAssignmentBackfillCommand(id, req.LeadIds ?? []), ct));

    public sealed record AssignmentBackfillRequest(IReadOnlyList<Guid>? LeadIds);

    /// <summary>Reveal the inbound URL + decrypted signing secret (for configuring HMAC senders).</summary>
    [HttpGet("{id:guid}/secret")]
    [RequirePermission("settings.integrations.edit")]
    public async Task<IActionResult> GetSecret(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetIntegrationSecretQuery(id), ct));

    [HttpPost]
    [RequirePermission("settings.integrations.edit")]
    public async Task<IActionResult> Create([FromBody] CreateIntegrationCommand cmd, CancellationToken ct)
    {
        var result = await sender.Send(cmd, ct);
        return CreatedOrError(result, nameof(GetById), new { id = result.IsSuccess ? (object?)result.Value.Id : null });
    }

    [HttpPut("{id:guid}/config")]
    [RequirePermission("settings.integrations.edit")]
    public async Task<IActionResult> UpdateConfig(Guid id, [FromBody] UpdateConfigRequest req, CancellationToken ct) =>
        NoContentOrError(await sender.Send(
            new UpdateIntegrationConfigCommand(id, req.Config, req.DedupeConfig, req.RoutingConfig, req.FieldMappings), ct));

    [HttpPut("{id:guid}/api-key")]
    [RequirePermission("settings.integrations.edit")]
    public async Task<IActionResult> SetApiKey(Guid id, [FromBody] ApiKeyRequest req, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new SetIntegrationApiKeyCommand(id, req.ApiKey), ct));

    /// <summary>Store a signing secret the provider issued (e.g. Bayut's Push key).</summary>
    [HttpPut("{id:guid}/signing-secret")]
    [RequirePermission("settings.integrations.edit")]
    public async Task<IActionResult> SetSigningSecret(Guid id, [FromBody] SigningSecretRequest req, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new SetIntegrationSigningSecretCommand(id, req.Secret), ct));

    /// <summary>
    /// Key for the listing-lookup service that resolves which agent holds a Bayut / dubizzle
    /// listing. Sending a blank key turns the lookup off.
    /// </summary>
    [HttpPut("{id:guid}/listing-lookup-key")]
    [RequirePermission("settings.integrations.edit")]
    public async Task<IActionResult> SetListingLookupKey(
        Guid id, [FromBody] ListingLookupKeyRequest req, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new SetListingLookupKeyCommand(id, req.ApiKey, req.BaseUrl), ct));

    public sealed record ListingLookupKeyRequest(string? ApiKey, string? BaseUrl);

    /// <summary>Import history from the provider (Bayut / dubizzle serve up to six months).</summary>
    [HttpPost("{id:guid}/backfill")]
    [RequirePermission("settings.integrations.import")]
    public async Task<IActionResult> Backfill(Guid id, [FromBody] BackfillRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new BackfillIntegrationLeadsCommand(id, req.Since), ct));

    [HttpPost("{id:guid}/rotate-key")]
    [RequirePermission("settings.integrations.edit")]
    public async Task<IActionResult> RotateKey(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new RotateInboundKeyCommand(id), ct));

    [HttpPost("{id:guid}/disconnect")]
    [RequirePermission("settings.integrations.edit")]
    public async Task<IActionResult> Disconnect(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DisconnectIntegrationCommand(id), ct));

    [HttpDelete("{id:guid}")]
    [RequirePermission("settings.integrations.edit")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteIntegrationCommand(id), ct));

    public sealed record UpdateConfigRequest(
        string? Config, string? DedupeConfig, string? RoutingConfig,
        IReadOnlyList<FieldMappingInput>? FieldMappings);

    public sealed record ApiKeyRequest(string ApiKey);

    public sealed record SigningSecretRequest(string Secret);

    public sealed record BackfillRequest(DateTime Since);
}
