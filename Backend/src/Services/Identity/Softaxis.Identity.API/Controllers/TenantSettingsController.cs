using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Identity.Application.TenantSettings.Commands;
using Softaxis.Identity.Application.TenantSettings.Queries;

namespace Softaxis.Identity.API.Controllers;

/// <summary>
/// Self-service settings for the signed-in tenant (not super-admin). The tenant is resolved
/// from the JWT — no id in the route, so an admin can only ever change their own tenant.
/// </summary>
[ApiController]
[Route("api/tenant-settings")]
[Produces("application/json")]
[Authorize]
public sealed class TenantSettingsController(ISender sender) : BaseApiController(sender)
{
    /// <summary>Change the tenant's operating/display currency.</summary>
    [HttpPut("currency")]
    public async Task<IActionResult> UpdateCurrency([FromBody] UpdateCurrencyRequest req, CancellationToken ct)
        => HandleResult(await Sender.Send(new UpdateTenantCurrencyCommand(req.Currency), ct));

    /// <summary>Change the tenant's country.</summary>
    [HttpPut("country")]
    public async Task<IActionResult> UpdateCountry([FromBody] UpdateCountryRequest req, CancellationToken ct)
        => HandleResult(await Sender.Send(new UpdateTenantCountryCommand(req.Country), ct));

    /// <summary>This tenant's own object-storage usage against their plan's budget — drives the
    /// "approaching your storage limit" banner.</summary>
    [HttpGet("storage")]
    public async Task<IActionResult> GetStorageUsage(CancellationToken ct)
        => HandleResult(await Sender.Send(new GetTenantStorageUsageQuery(), ct));

    public sealed record UpdateCurrencyRequest(string Currency);
    public sealed record UpdateCountryRequest(string Country);
}
