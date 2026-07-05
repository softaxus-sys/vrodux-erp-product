using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Identity.Application.TenantSettings.Commands;

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

    public sealed record UpdateCurrencyRequest(string Currency);
}
