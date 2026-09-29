using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.RealEstate.API.Authorization;
using Softaxis.RealEstate.API.Controllers.Common;
using Softaxis.RealEstate.Application.QasroIntegrations;

namespace Softaxis.RealEstate.API.Controllers;

/// <summary>
/// Connects a workspace to Qasro (qasro.com) — Softaxis's sister property portal. Deliberately a
/// one-click flow: no address to type, no key to copy — see QasroIntegrationFeature's remarks.
/// Reuses the same real-estate.website.* permissions as the "own website" integration: both are
/// the same underlying decision ("who may control what gets published externally").
/// </summary>
[ApiController]
[Route("api/real-estate/qasro-integration")]
[Authorize]
public sealed class QasroIntegrationController(ISender sender) : RealEstateControllerBase
{
    /// <summary>204 when Qasro has never been connected.</summary>
    [HttpGet]
    [RequirePermission("real-estate.website.view")]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var result = await sender.Send(new GetQasroIntegrationQuery(), ct);
        return result.IsSuccess && result.Value is null ? NoContent() : OkOrError(result);
    }

    [HttpGet("published")]
    [RequirePermission("real-estate.website.view")]
    public async Task<IActionResult> GetPublished(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetQasroPublishedPropertiesQuery(), ct));

    [HttpPost("connect")]
    [RequirePermission("real-estate.website.edit")]
    public async Task<IActionResult> Connect(CancellationToken ct) =>
        OkOrError(await sender.Send(new ConnectQasroCommand(), ct));

    [HttpPost("disconnect")]
    [RequirePermission("real-estate.website.edit")]
    public async Task<IActionResult> Disconnect(CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DisconnectQasroCommand(), ct));

    /// <summary>Takes every property off Qasro. Uses the property edit permission, like the
    /// per-property toggle and the equivalent "own website" endpoint.</summary>
    [HttpPost("withdraw-all")]
    [RequirePermission("real-estate.properties.edit")]
    public async Task<IActionResult> WithdrawAll(CancellationToken ct) =>
        OkOrError(await sender.Send(new WithdrawAllQasroListingsCommand(), ct));
}
