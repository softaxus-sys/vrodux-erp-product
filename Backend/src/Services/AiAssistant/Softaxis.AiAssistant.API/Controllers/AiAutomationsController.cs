using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.AiAssistant.API.Authorization;
using Softaxis.AiAssistant.API.Controllers.Common;
using Softaxis.AiAssistant.Application.Automations;
using Softaxis.AiAssistant.Application.Automations.Commands;
using Softaxis.AiAssistant.Application.Automations.Queries;

namespace Softaxis.AiAssistant.API.Controllers;

/// <summary>
/// Scheduled autonomous automations (M4). Each rule runs the assistant on a schedule as a chosen
/// run-as user; autopilot rules perform writes automatically, confirm rules queue writes for approval.
/// Managed by tenant admins (gated on <c>settings.ai</c>).
/// </summary>
[ApiController]
[Route("api/ai/automations")]
[Authorize]
public sealed class AiAutomationsController(ISender sender) : AiAssistantControllerBase
{
    [HttpGet]
    [RequirePermission("settings.ai.view")]
    public async Task<IActionResult> GetAll(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetAutomationRulesQuery(), ct));

    /// <summary>The events an event-triggered automation can be built on (static catalog).</summary>
    [HttpGet("event-types")]
    [RequirePermission("settings.ai.view")]
    public IActionResult GetEventTypes() => Ok(AiEventCatalog.Items);

    [HttpGet("{id:guid}")]
    [RequirePermission("settings.ai.view")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetAutomationRuleByIdQuery(id), ct));

    [HttpPost]
    [RequirePermission("settings.ai.edit")]
    public async Task<IActionResult> Create([FromBody] CreateAutomationRuleCommand cmd, CancellationToken ct) =>
        OkOrError(await sender.Send(cmd, ct));

    [HttpPut("{id:guid}")]
    [RequirePermission("settings.ai.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateAutomationRuleCommand cmd, CancellationToken ct) =>
        OkOrError(await sender.Send(cmd with { Id = id }, ct));

    [HttpPost("{id:guid}/enable")]
    [RequirePermission("settings.ai.edit")]
    public async Task<IActionResult> Enable(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new ToggleAutomationRuleCommand(id, true), ct));

    [HttpPost("{id:guid}/disable")]
    [RequirePermission("settings.ai.edit")]
    public async Task<IActionResult> Disable(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new ToggleAutomationRuleCommand(id, false), ct));

    [HttpDelete("{id:guid}")]
    [RequirePermission("settings.ai.edit")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteAutomationRuleCommand(id), ct));

    [HttpPost("{id:guid}/run")]
    [RequirePermission("settings.ai.edit")]
    public async Task<IActionResult> RunNow(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new RunAutomationRuleNowCommand(id), ct));

    [HttpPost("runs/{runId:guid}/approve")]
    [RequirePermission("settings.ai.edit")]
    public async Task<IActionResult> ApproveRun(Guid runId, CancellationToken ct) =>
        OkOrError(await sender.Send(new ConfirmAutomationRunCommand(runId, Approve: true), ct));

    [HttpPost("runs/{runId:guid}/reject")]
    [RequirePermission("settings.ai.edit")]
    public async Task<IActionResult> RejectRun(Guid runId, CancellationToken ct) =>
        OkOrError(await sender.Send(new ConfirmAutomationRunCommand(runId, Approve: false), ct));
}
