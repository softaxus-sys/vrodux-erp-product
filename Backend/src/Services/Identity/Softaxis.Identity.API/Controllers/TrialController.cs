using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Softaxis.Identity.API.Models;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Application.DTOs;
using Softaxis.Identity.Domain.Entities;   // Tenant, AuditLog
using Softaxis.Identity.Domain.Enums;      // PlanType, DeploymentType
using Softaxis.Identity.Domain.Repositories;
// User.Create is called with full qualification below to avoid
// ambiguity with System.IO / FileSystemAclExtensions in .NET 10.

namespace Softaxis.Identity.API.Controllers;

/// <summary>
/// Public trial-registration endpoints — no JWT required.
///
/// Security model (challenge-response with single-use nonces):
///   1. Client calls GET /api/trial/challenge  → receives an opaque token (valid 10 min, single-use).
///   2. Client calls POST /api/trial/register  with the token in X-Trial-Token header.
///   3. Backend verifies HMAC signature, timestamp, and burns the nonce — replay is impossible.
///   4. Both endpoints are rate-limited per IP to prevent abuse.
///
/// The HMAC secret lives only on the server (Trial:ChallengeSecret in config).
/// No secret is ever embedded in or returned to the client.
/// </summary>
[ApiController]
[Route("api/trial")]
[AllowAnonymous]
[Produces("application/json")]
public sealed class TrialController(
    ITrialChallengeService challengeService,
    ITenantRepository      tenantRepo,
    IUserRepository        userRepo,
    IRoleRepository        roleRepo,
    IAuditLogRepository    auditRepo,
    IPasswordHasher        passwordHasher,
    IUnitOfWork            uow,
    ILogger<TrialController> logger) : ControllerBase
{
    // ── GET /api/trial/challenge ──────────────────────────────────────────────
    // Generates a short-lived single-use challenge token.
    // Rate limit: 5 requests / IP / 60 s.

    [HttpGet("challenge")]
    [EnableRateLimiting("trial_challenge")]
    public IActionResult GetChallenge()
    {
        var token = challengeService.Generate();
        logger.LogInformation("Trial challenge issued to {IP}", HttpContext.Connection.RemoteIpAddress);
        return Ok(ApiResponse<object>.Ok(new { token }));
    }

    // ── POST /api/trial/register ──────────────────────────────────────────────
    // Creates a new tenant (Trial/Cloud, 30 days) and its first admin user.
    // Requires a valid X-Trial-Token header obtained from GET /challenge.
    // Rate limit: 3 requests / IP / 300 s.

    [HttpPost("register")]
    [EnableRateLimiting("trial_register")]
    public async Task<IActionResult> Register(
        [FromBody] TrialRegistrationRequest req,
        CancellationToken ct)
    {
        // ── 1. Verify challenge token ─────────────────────────────────────────

        var challengeToken = Request.Headers["X-Trial-Token"].FirstOrDefault();
        if (!challengeService.Consume(challengeToken))
        {
            logger.LogWarning(
                "Trial registration rejected — invalid/missing challenge token. IP={IP}",
                HttpContext.Connection.RemoteIpAddress);
            return Unauthorized(ApiResponse<TrialRegistrationResponse>.Fail(
                "Trial.InvalidChallenge",
                "Missing or invalid challenge token. Call GET /api/trial/challenge first."));
        }

        // ── 2. Basic input validation ─────────────────────────────────────────

        if (string.IsNullOrWhiteSpace(req.Email))
            return BadRequest(ApiResponse<TrialRegistrationResponse>.Fail("Trial.Email.Required", "Email is required."));

        if (string.IsNullOrWhiteSpace(req.Password) || req.Password.Length < 8)
            return BadRequest(ApiResponse<TrialRegistrationResponse>.Fail("Trial.Password.Weak", "Password must be at least 8 characters."));

        if (!System.Text.RegularExpressions.Regex.IsMatch(req.Password, "[A-Z]"))
            return BadRequest(ApiResponse<TrialRegistrationResponse>.Fail("Trial.Password.Weak", "Password must contain at least one uppercase letter."));

        if (!System.Text.RegularExpressions.Regex.IsMatch(req.Password, "[0-9]"))
            return BadRequest(ApiResponse<TrialRegistrationResponse>.Fail("Trial.Password.Weak", "Password must contain at least one digit."));

        if (string.IsNullOrWhiteSpace(req.OrgName))
            return BadRequest(ApiResponse<TrialRegistrationResponse>.Fail("Trial.Org.Required", "Organisation name is required."));

        // ── 3. Uniqueness checks ──────────────────────────────────────────────

        if (await userRepo.EmailExistsAsync(req.Email.Trim().ToLowerInvariant(), ct))
            return Conflict(ApiResponse<TrialRegistrationResponse>.Fail(
                "User.Email.Taken", "This email is already registered."));

        var username = GenerateUsername(req.Email);
        if (await userRepo.UsernameExistsAsync(username, ct))
            username = $"{username}_{Guid.NewGuid().ToString("N")[..6]}";

        var slug = GenerateSlug(req.OrgName);
        if (await tenantRepo.SlugExistsAsync(slug, ct))
            slug = $"{slug}-{Guid.NewGuid().ToString("N")[..5]}";

        // ── 4. Create tenant ──────────────────────────────────────────────────

        var tenant = Tenant.Create(
            name:           req.OrgName.Trim(),
            slug:           slug,
            plan:           PlanType.Starter,   // trial period tracked via TenantStatus.Trial + TrialEndsAt
            deploymentType: DeploymentType.Cloud,
            contactEmail:   req.Email.Trim().ToLowerInvariant(),
            country:        req.Country,
            industry:       NormaliseIndustry(req.Industry));

        tenant.StartTrial(30);

        if (req.Modules is { Count: > 0 })
            tenant.SetEnabledModules(req.Modules);

        tenantRepo.Add(tenant);

        // ── 5. Create admin user ──────────────────────────────────────────────

        var nameParts = req.FullName?.Trim().Split(' ', 2, StringSplitOptions.RemoveEmptyEntries) ?? [];
        var firstName = nameParts.Length > 0 ? nameParts[0] : "Tenant";
        var lastName  = nameParts.Length > 1 ? nameParts[1] : "Admin";

        var userResult = Softaxis.Identity.Domain.Entities.User.Create(
            req.Email.Trim().ToLowerInvariant(),
            username,
            firstName,
            lastName,
            passwordHasher.Hash(req.Password));

        if (userResult.IsFailure)
            return BadRequest(ApiResponse<TrialRegistrationResponse>.Fail(
                userResult.Error.Code, userResult.Error.Description));

        var user = userResult.Value;
        user.VerifyEmail();       // trial accounts are pre-verified
        user.SetTenant(tenant.Id);

        var adminRole = await roleRepo.GetByNameAsync("Administrator", ct);
        if (adminRole is not null)
            user.AssignRole(adminRole.Id);

        userRepo.Add(user);

        auditRepo.Add(new AuditLog(
            user.Id, "TRIAL_REGISTER", "Tenant", tenant.Id.ToString(),
            null, null, null, null, true, tenant.Id));

        await uow.SaveChangesAsync(ct);

        logger.LogInformation(
            "Trial tenant created. TenantId={TenantId} Slug={Slug} Email={Email} Modules=[{Modules}]",
            tenant.Id, tenant.Slug, req.Email,
            req.Modules is not null ? string.Join(',', req.Modules) : "default");

        return StatusCode(201, ApiResponse<TrialRegistrationResponse>.Ok(new TrialRegistrationResponse(
            TenantId:    tenant.Id,
            TenantSlug:  tenant.Slug,
            UserId:      user.Id,
            Email:       user.Email.Value,
            TrialEndsAt: tenant.TrialEndsAt)));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static string GenerateSlug(string orgName) =>
        System.Text.RegularExpressions.Regex.Replace(
            orgName.ToLowerInvariant().Trim(), @"[^a-z0-9]+", "-").Trim('-');

    private static string GenerateUsername(string email) =>
        System.Text.RegularExpressions.Regex.Replace(
            email.Split('@')[0].ToLowerInvariant(), @"[^a-z0-9_.\-]", "_");

    private static string? NormaliseIndustry(string? industry) =>
        string.IsNullOrWhiteSpace(industry) || industry is "Other" or "All Industries"
            ? null
            : industry.ToLowerInvariant()
                      .Replace(" & ", "_").Replace(" ", "_").Replace("/", "_");
}

// ── Request / Response models ─────────────────────────────────────────────────

public sealed record TrialRegistrationRequest(
    string         FullName,
    string         Email,
    string         Password,
    string         OrgName,
    string?        Industry,
    string?        Country,
    string?        BusinessType,
    string?        FiscalYear,
    string?        Language,
    string?        Currency,
    string?        Timezone,
    List<string>?  Modules
);

public sealed record TrialRegistrationResponse(
    Guid      TenantId,
    string    TenantSlug,
    Guid      UserId,
    string    Email,
    DateTime? TrialEndsAt
);
