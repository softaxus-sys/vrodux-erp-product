using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Domain.Repositories;
using Softaxis.Identity.API.Models;

namespace Softaxis.Identity.API.Controllers;

/// <summary>
/// License validation and heartbeat for on-premises deployments.
/// On-prem instances call /api/license/heartbeat daily to confirm they're connected.
/// 7-day grace period: if the cloud is unreachable, the on-prem instance continues to function.
/// </summary>
[ApiController]
[Route("api/license")]
[Produces("application/json")]
public sealed class LicenseController(
    ITenantRepository tenantRepo,
    ILicenseService   licenseService,
    IUnitOfWork       uow) : ControllerBase
{
    /// <summary>
    /// POST /api/license/heartbeat
    /// Called by on-prem clients daily. Validates the license key and records the ping.
    /// Body: { "tenantId": "...", "licenseKey": "..." }
    /// </summary>
    [HttpPost("heartbeat")]
    [AllowAnonymous]
    public async Task<IActionResult> Heartbeat(
        [FromBody] HeartbeatRequest req,
        CancellationToken ct)
    {
        if (req.TenantId == Guid.Empty || string.IsNullOrWhiteSpace(req.LicenseKey))
            return BadRequest(ApiResponse<HeartbeatResponse>.Fail(
                "License.Invalid", "TenantId and LicenseKey are required."));

        var tenant = await tenantRepo.GetByIdAsync(req.TenantId, ct);
        if (tenant is null)
            return NotFound(ApiResponse<HeartbeatResponse>.Fail(
                "Tenant.NotFound", "Tenant not found."));

        // Validate license key signature + expiry
        var payload = licenseService.ValidateLicenseKey(req.LicenseKey);
        if (payload is null || payload.TenantId != req.TenantId)
            return StatusCode(403, ApiResponse<HeartbeatResponse>.Fail(
                "License.Invalid", "License key is invalid or expired."));

        tenant.RecordHeartbeat();
        tenantRepo.Update(tenant);
        await uow.SaveChangesAsync(ct);

        return Ok(ApiResponse<HeartbeatResponse>.Ok(new HeartbeatResponse(
            Valid:       true,
            Plan:        payload.Plan,
            MaxUsers:    payload.MaxUsers,
            ExpiresAt:   payload.ExpiresAt,
            ServerTime:  DateTime.UtcNow)));
    }

    /// <summary>
    /// POST /api/license/validate
    /// Super-admin: validate any license key string.
    /// </summary>
    [HttpPost("validate")]
    [Authorize(Policy = "SuperAdminOnly")]
    public IActionResult Validate([FromBody] ValidateLicenseRequest req)
    {
        var payload = licenseService.ValidateLicenseKey(req.LicenseKey);
        if (payload is null)
            return Ok(ApiResponse<object>.Ok(new { Valid = false }));

        return Ok(ApiResponse<object>.Ok(new
        {
            Valid      = true,
            payload.TenantId,
            payload.TenantSlug,
            payload.Plan,
            payload.MaxUsers,
            payload.Features,
            payload.IssuedAt,
            payload.ExpiresAt,
        }));
    }
}

public sealed record HeartbeatRequest(Guid TenantId, string LicenseKey);

public sealed record HeartbeatResponse(
    bool     Valid,
    string   Plan,
    int      MaxUsers,
    DateTime ExpiresAt,
    DateTime ServerTime);

public sealed record ValidateLicenseRequest(string LicenseKey);
