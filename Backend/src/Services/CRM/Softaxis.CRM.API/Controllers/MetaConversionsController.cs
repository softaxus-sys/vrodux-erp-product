using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.CRM.API.Authorization;
using Softaxis.CRM.API.Controllers.Common;
using Softaxis.CRM.Application.Integrations.MetaConversions;

namespace Softaxis.CRM.API.Controllers;

/// <summary>
/// Lead quality reported back to Meta (Conversions API for CRM). Hangs off a connected Meta integration:
/// the dataset and token to send to, which stage changes to report, and a log of what was sent.
/// Same permissions as the rest of the integration screen — viewing needs
/// <c>settings.integrations.view</c>, changing or sending anything needs <c>.edit</c>.
/// </summary>
[ApiController]
[Route("api/crm/integrations/meta/{id:guid}/conversions")]
[Authorize]
public sealed class MetaConversionsController(ISender sender) : CrmControllerBase
{
    [HttpGet]
    [RequirePermission("settings.integrations.view")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetMetaConversionsQuery(id), ct));

    [HttpPut]
    [RequirePermission("settings.integrations.edit")]
    public async Task<IActionResult> Save(Guid id, [FromBody] SaveRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new SaveMetaConversionsCommand(
            id, req.Enabled, req.DatasetId, req.AccessToken, req.SendDealValue, req.DefaultCallingCode,
            req.LeadEvents, req.DealEvents), ct));

    [HttpPost("verify")]
    [RequirePermission("settings.integrations.edit")]
    public async Task<IActionResult> Verify(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new VerifyMetaConversionsCommand(id), ct));

    [HttpPost("test")]
    [RequirePermission("settings.integrations.edit")]
    public async Task<IActionResult> Test(Guid id, [FromBody] TestRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new SendMetaTestEventCommand(id, req.TestEventCode), ct));

    [HttpPost("catch-up")]
    [RequirePermission("settings.integrations.edit")]
    public async Task<IActionResult> CatchUp(Guid id, [FromBody] CatchUpRequest? req, CancellationToken ct) =>
        OkOrError(await sender.Send(new CatchUpMetaConversionsCommand(id, req?.Days ?? 7), ct));

    [HttpPost("retry-failed")]
    [RequirePermission("settings.integrations.edit")]
    public async Task<IActionResult> RetryFailed(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new RetryFailedMetaConversionsCommand(id), ct));

    [HttpGet("events")]
    [RequirePermission("settings.integrations.view")]
    public async Task<IActionResult> Events(Guid id, [FromQuery] string? status, [FromQuery] int take = 50, CancellationToken ct = default) =>
        OkOrError(await sender.Send(new GetMetaConversionEventsQuery(id, status, take), ct));

    public sealed record SaveRequest(
        bool Enabled, string? DatasetId, string? AccessToken, bool SendDealValue, string? DefaultCallingCode,
        Dictionary<string, string>? LeadEvents, Dictionary<string, string>? DealEvents);

    public sealed record TestRequest(string TestEventCode);
    public sealed record CatchUpRequest(int Days = 7);
}
