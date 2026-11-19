using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Softaxis.Identity.API.Extensions;
using Softaxis.Identity.Infrastructure.Sso;

namespace Softaxis.Identity.API.Controllers;

/// <summary>
/// Sign in with Microsoft 365. Three anonymous steps (start, callback, exchange) plus the workspace
/// administrator's settings. The password sign-in path is not touched.
/// </summary>
[ApiController]
[Produces("application/json")]
public sealed class MicrosoftSignInController(ISender sender, IConfiguration config) : BaseApiController(sender)
{
    /// <summary>The address Microsoft sends the browser back to. Configurable so it is right behind a proxy.</summary>
    private string Callback =>
        $"{(config["Sso:PublicApiBase"] ?? $"{Request.Scheme}://{Request.Host}").TrimEnd('/')}/api/auth/microsoft/callback";

    private string FrontendUrl => (config["FrontendUrl"] ?? "http://localhost:5173").TrimEnd('/');

    public sealed record StartRequest(string Email);
    public sealed record ExchangeRequest(string Code);
    public sealed record SaveRequest(bool Enabled, string? DirectoryId, string? ClientId, string? ClientSecret);

    [HttpPost("/api/auth/microsoft/start")][AllowAnonymous][EnableRateLimiting(AuthRateLimitPolicies.SsoSignIn)]
    public async Task<IActionResult> Start([FromBody] StartRequest req, CancellationToken ct) =>
        HandleResult(await Sender.Send(new StartMicrosoftSignInQuery(req.Email, Callback), ct));

    /// <summary>Microsoft returns the browser here. Redirects on to the app with either a one-time code or an error message.</summary>
    [HttpGet("/api/auth/microsoft/callback")][AllowAnonymous][EnableRateLimiting(AuthRateLimitPolicies.SsoSignIn)]
    public async Task<IActionResult> CallbackFromMicrosoft([FromQuery] string? code, [FromQuery] string? state, [FromQuery] string? error,
        [FromQuery(Name = "error_description")] string? errorDescription, CancellationToken ct)
    {
        var r = await Sender.Send(new CompleteMicrosoftSignInCommand(state, code, error, errorDescription), ct);
        var d = r.IsSuccess ? r.Value : new MicrosoftCompleteDto(null, "Microsoft sign-in failed. Please try again.");
        return Redirect(d.Code is not null
            ? $"{FrontendUrl}/auth/sso?code={Uri.EscapeDataString(d.Code)}"
            : $"{FrontendUrl}/auth/sso?error={Uri.EscapeDataString(d.Error ?? "Microsoft sign-in failed.")}");
    }

    [HttpPost("/api/auth/microsoft/exchange")][AllowAnonymous][EnableRateLimiting(AuthRateLimitPolicies.SsoSignIn)]
    public async Task<IActionResult> Exchange([FromBody] ExchangeRequest req, CancellationToken ct) =>
        HandleResult(await Sender.Send(new ExchangeMicrosoftCodeCommand(req.Code, HttpContext.Connection.RemoteIpAddress?.ToString()), ct));

    [HttpGet("/api/tenant-settings/microsoft-signin")][Authorize]
    public async Task<IActionResult> Get(CancellationToken ct) => HandleResult(await Sender.Send(new GetMicrosoftSignInQuery(Callback), ct));

    [HttpPut("/api/tenant-settings/microsoft-signin")][Authorize]
    public async Task<IActionResult> Save([FromBody] SaveRequest req, CancellationToken ct) =>
        HandleResult(await Sender.Send(new SaveMicrosoftSignInCommand(req.Enabled, req.DirectoryId, req.ClientId, req.ClientSecret, Callback), ct));
}
