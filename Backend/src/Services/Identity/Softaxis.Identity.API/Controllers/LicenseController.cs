using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Softaxis.Identity.Application.License.Commands.ActivateLicense;
using Softaxis.Identity.Application.License.Commands.Heartbeat;
using Softaxis.Identity.Application.License.Queries.LicenseStatus;
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
    /// POST /api/license/activate
    /// Installs a renewed or upgraded license key into this installation. No restart.
    ///
    /// <para>
    /// Anonymous by necessity: an installation whose license has lapsed blocks every request, so
    /// there is nobody left who can sign in to authorise this. The RSA-signed key is the
    /// authorisation - it can only have come from us, and it names the workspace it is for.
    /// </para>
    ///
    /// <para>
    /// Rate limited. It is anonymous and it tells you whether a key is valid, so without a limit
    /// it is an oracle someone could sit and grind against. Signature forgery is not the risk;
    /// the limit just stops the endpoint being useful to poke at.
    /// </para>
    /// </summary>
    [HttpPost("activate")]
    [AllowAnonymous]
    [EnableRateLimiting("license_activation")]
    public async Task<IActionResult> Activate([FromBody] ActivateLicenseRequest req, CancellationToken ct)
        => HandleResult(await Sender.Send(new ActivateLicenseCommand(req.LicenseKey), ct));

    /// <summary>
    /// GET /api/license/status
    /// Whether this installation is licensed and until when, so the activation screen can explain
    /// itself to someone who cannot sign in. Carries no workspace name and no key.
    /// </summary>
    [HttpGet("status")]
    [AllowAnonymous]
    public async Task<IActionResult> Status(CancellationToken ct)
        => HandleResult(await Sender.Send(new LicenseStatusQuery(), ct));

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

public sealed record ActivateLicenseRequest(string LicenseKey);
