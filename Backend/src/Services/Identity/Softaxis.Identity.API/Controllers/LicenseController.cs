using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Identity.Application.License.Commands.Heartbeat;
using Softaxis.Identity.Application.License.Queries.ValidateLicenseKey;

namespace Softaxis.Identity.API.Controllers;

/// <summary>
/// License validation and heartbeat for on-premises deployments.
/// On-prem instances call /api/license/heartbeat daily to confirm they're connected.
/// 7-day grace period: if the cloud is unreachable, the on-prem instance continues to function.
/// </summary>
[ApiController]
[Route("api/license")]
[Produces("application/json")]
public sealed class LicenseController(ISender sender) : BaseApiController(sender)
{
    /// <summary>
    /// POST /api/license/heartbeat
    /// Called by on-prem clients daily. Validates the license key and records the ping.
    /// Body: { "tenantId": "...", "licenseKey": "..." }
    /// </summary>
    [HttpPost("heartbeat")]
    [AllowAnonymous]
    public async Task<IActionResult> Heartbeat([FromBody] HeartbeatRequest req, CancellationToken ct)
    {
        var result = await Sender.Send(new LicenseHeartbeatCommand(req.TenantId, req.LicenseKey), ct);
        return HandleResult(result);
    }

    /// <summary>
    /// POST /api/license/validate
    /// Super-admin: validate any license key string.
    /// </summary>
    [HttpPost("validate")]
    [Authorize(Policy = "SuperAdminOnly")]
    public async Task<IActionResult> Validate([FromBody] ValidateLicenseRequest req, CancellationToken ct)
    {
        var result = await Sender.Send(new ValidateLicenseKeyQuery(req.LicenseKey), ct);
        return HandleResult(result);
    }
}

public sealed record HeartbeatRequest(Guid TenantId, string LicenseKey);

public sealed record ValidateLicenseRequest(string LicenseKey);
