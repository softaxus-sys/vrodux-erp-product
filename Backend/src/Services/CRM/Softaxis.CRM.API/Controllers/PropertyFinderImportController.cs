using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.CRM.API.Authorization;
using Softaxis.CRM.API.Controllers.Common;
using Softaxis.CRM.Application.PropertyFinderImport.Commands;
using Softaxis.CRM.Application.PropertyFinderImport.Dtos;
using Softaxis.CRM.Application.PropertyFinderImport.Queries;

namespace Softaxis.CRM.API.Controllers;

/// <summary>
/// Property Finder migration — reads the connected PF account so an administrator can review the
/// agent/role mapping before anything is created.
///
/// Gated on <c>settings.integrations.edit</c> rather than a CRM permission: this configures a data
/// source and (via the mapping it produces) results in real logins being created, which is an
/// administrative act, not day-to-day CRM work.
/// </summary>
[ApiController]
[Route("api/crm/property-finder")]
[Authorize]
public sealed class PropertyFinderImportController(ISender sender) : CrmControllerBase
{
    /// <summary>Read-only dry run. Writes nothing to Property Finder or to our database.</summary>
    [HttpGet("preview")]
    [RequirePermission("settings.integrations.import")]
    public async Task<IActionResult> Preview(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetPropertyFinderPreviewQuery(), ct));

    /// <summary>
    /// Import the lead history, assigning each lead to the Vrodux user mapped to its Property
    /// Finder agent. Safe to re-run — intake dedupes on the Property Finder lead id.
    /// Send <c>dryRun: true</c> first to see the counts without writing anything.
    /// </summary>
    [HttpPost("import-leads")]
    [RequirePermission("settings.integrations.import")]
    public async Task<IActionResult> ImportLeads([FromBody] ImportLeadsRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new ImportPropertyFinderLeadsCommand(
            req.Assignments ?? [], req.FallbackUserId, req.FallbackUserName, req.TeamId, req.DryRun,
            req.Skip ?? 0, req.Take ?? 250), ct));

    /// <summary>
    /// Stores this workspace's own Property Finder API key. Credentials are per-tenant and
    /// encrypted at rest — a shared key would let one agency import another's data.
    /// </summary>
    [HttpPut("credentials/{integrationId:guid}")]
    [RequirePermission("settings.integrations.import")]
    public async Task<IActionResult> SetCredentials(
        Guid integrationId, [FromBody] SetCredentialsRequest req, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new SetPropertyFinderCredentialsCommand(
            integrationId, req.ApiKey, req.ApiSecret), ct));

    public sealed record SetCredentialsRequest(string ApiKey, string ApiSecret);

    /// <summary>Is live sync running? Asks Property Finder what it actually holds.</summary>
    [HttpGet("webhooks/{integrationId:guid}")]
    [RequirePermission("settings.integrations.import")]
    public async Task<IActionResult> Webhooks(Guid integrationId, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetPropertyFinderWebhooksQuery(integrationId), ct));

    /// <summary>
    /// Register this integration's inbound URL with Property Finder so new enquiries arrive on
    /// their own. Idempotent — an existing subscription to our URL is left alone.
    /// </summary>
    [HttpPost("webhooks/{integrationId:guid}")]
    [RequirePermission("settings.integrations.import")]
    public async Task<IActionResult> Subscribe(Guid integrationId, CancellationToken ct) =>
        OkOrError(await sender.Send(new SubscribePropertyFinderWebhooksCommand(integrationId), ct));

    public sealed record ImportLeadsRequest(
        IReadOnlyList<PfAgentAssignment>? Assignments,
        Guid?   FallbackUserId,
        string? FallbackUserName,
        Guid?   TeamId,
        bool    DryRun,
        int?    Skip,
        int?    Take);
}
