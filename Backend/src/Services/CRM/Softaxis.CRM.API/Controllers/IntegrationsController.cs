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

    [HttpPost]
    [RequirePermission("settings.integrations.edit")]
    public async Task<IActionResult> Create([FromBody] CreateIntegrationCommand cmd, CancellationToken ct)
    {
        var result = await sender.Send(cmd, ct);
        return CreatedOrError(result, nameof(GetById), new { id = result.Value?.Id });
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
}
