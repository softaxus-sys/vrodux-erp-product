using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Softaxis.Identity.Application.Trial.Commands.RegisterTrial;
using Softaxis.Identity.Application.Trial.Queries.GetTrialChallenge;

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
public sealed class TrialController(ISender sender) : BaseApiController(sender)
{
    // ── GET /api/trial/challenge ──────────────────────────────────────────────
    // Generates a short-lived single-use challenge token.
    // Rate limit: 5 requests / IP / 60 s.

    [HttpGet("challenge")]
    [EnableRateLimiting("trial_challenge")]
    public async Task<IActionResult> GetChallenge(CancellationToken ct)
    {
        var result = await Sender.Send(new GetTrialChallengeQuery(HttpContext.Connection.RemoteIpAddress?.ToString()), ct);
        return HandleResult(result);
    }

    // ── POST /api/trial/register ──────────────────────────────────────────────
    // Creates a new tenant (Trial/Cloud, 30 days) and its first admin user.
    // Requires a valid X-Trial-Token header obtained from GET /challenge.
    // Rate limit: 3 requests / IP / 300 s.

    [HttpPost("register")]
    [EnableRateLimiting("trial_register")]
    public async Task<IActionResult> Register([FromBody] TrialRegistrationRequest req, CancellationToken ct)
    {
        var challengeToken = Request.Headers["X-Trial-Token"].FirstOrDefault();

        var result = await Sender.Send(new RegisterTrialCommand(
            challengeToken,
            HttpContext.Connection.RemoteIpAddress?.ToString(),
            req.FullName,
            req.Email,
            req.Password,
            req.OrgName,
            req.Industry,
            req.Country,
            req.BusinessType,
            req.FiscalYear,
            req.Language,
            req.Currency,
            req.Timezone,
            req.Modules), ct);

        return result.IsSuccess ? HandleResult(result, successCode: 201) : HandleResult(result);
    }
}

// ── Request models ─────────────────────────────────────────────────────────────

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
