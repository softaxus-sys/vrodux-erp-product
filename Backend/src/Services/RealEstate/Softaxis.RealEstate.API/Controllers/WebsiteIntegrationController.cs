using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.RealEstate.API.Authorization;
using Softaxis.RealEstate.API.Controllers.Common;
using Softaxis.RealEstate.Application.WebsiteIntegrations;

namespace Softaxis.RealEstate.API.Controllers;

/// <summary>Connects a workspace's website: its address, its API key, and what it shows.</summary>
[ApiController]
[Route("api/real-estate/website-integration")]
[Authorize]
public sealed class WebsiteIntegrationController(ISender sender) : RealEstateControllerBase
{
    /// <summary>204 when no website has been connected yet.</summary>
    [HttpGet]
    [RequirePermission("real-estate.website.view")]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var result = await sender.Send(new GetWebsiteIntegrationQuery(), ct);
        return result.IsSuccess && result.Value is null ? NoContent() : OkOrError(result);
    }

    [HttpGet("published")]
    [RequirePermission("real-estate.website.view")]
    public async Task<IActionResult> GetPublished(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetPublishedPropertiesQuery(), ct));

    [HttpPost]
    [RequirePermission("real-estate.website.edit")]
    public async Task<IActionResult> Create([FromBody] WebsiteReq req, CancellationToken ct) =>
        OkOrError(await sender.Send(new CreateWebsiteIntegrationCommand(req.Name, req.WebsiteUrl), ct));

    [HttpPut]
    [RequirePermission("real-estate.website.edit")]
    public async Task<IActionResult> Update([FromBody] WebsiteReq req, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpdateWebsiteIntegrationCommand(req.Name, req.WebsiteUrl), ct));

    [HttpPost("regenerate-key")]
    [RequirePermission("real-estate.website.edit")]
    public async Task<IActionResult> RegenerateKey(CancellationToken ct) =>
        OkOrError(await sender.Send(new RegenerateWebsiteApiKeyCommand(), ct));

    [HttpPatch("active")]
    [RequirePermission("real-estate.website.edit")]
    public async Task<IActionResult> SetActive([FromBody] ActiveReq req, CancellationToken ct) =>
        OkOrError(await sender.Send(new SetWebsiteIntegrationActiveCommand(req.IsActive), ct));

    /// <summary>Takes every property off the website. Uses the property edit permission, like the per-property toggle.</summary>
    [HttpPost("withdraw-all")]
    [RequirePermission("real-estate.properties.edit")]
    public async Task<IActionResult> WithdrawAll(CancellationToken ct) =>
        OkOrError(await sender.Send(new WithdrawAllWebsiteListingsCommand(), ct));

    public sealed record WebsiteReq(string Name, string WebsiteUrl);
    public sealed record ActiveReq(bool IsActive);
}
