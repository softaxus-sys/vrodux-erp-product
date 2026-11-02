using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Softaxis.Fitness.API.Authorization;
using Softaxis.Fitness.API.Controllers.Common;
using Softaxis.Fitness.API.Extensions;
using Softaxis.Fitness.Application.Portal;

namespace Softaxis.Fitness.API.Controllers;

/// <summary>Staff side of the member portal: switching it on, and giving a member a PIN.</summary>
[Route("api/fitness")][Authorize]
public sealed class PortalAdminController(ISender sender) : FitnessControllerBase
{
    [HttpGet("portal-settings")]
    [RequirePermission("fitness.setup.view", "fitness.setup.edit")]
    public async Task<IActionResult> GetSettings(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetPortalSettingsQuery(), ct));

    [HttpPut("portal-settings")]
    [RequirePermission("fitness.setup.edit")]
    public async Task<IActionResult> UpdateSettings([FromBody] SettingsRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpdatePortalSettingsCommand(req.Enabled, req.AllowBooking), ct));

    /// <summary>Gives the member online access. The PIN in the reply cannot be read again.</summary>
    [HttpPost("members/{id:guid}/portal-pin")]
    [RequirePermission("fitness.members.edit")]
    public async Task<IActionResult> SetPin(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new SetMemberPortalPinCommand(id), ct));

    [HttpDelete("members/{id:guid}/portal-pin")]
    [RequirePermission("fitness.members.edit")]
    public async Task<IActionResult> ClearPin(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new ClearMemberPortalPinCommand(id), ct));

    public sealed record SettingsRequest(bool Enabled, bool AllowBooking);
}

/// <summary>
/// The member portal. No staff sign-in: the gym comes from the address and the member from the
/// session they were given at sign-in (the X-Member-Token header). Members are not users of the
/// application and hold none of its permissions.
/// </summary>
[Route("api/fitness/portal/{slug}")]
[AllowAnonymous]
[EnableRateLimiting(FitnessRateLimitPolicies.Portal)]
public sealed class PortalController(ISender sender) : FitnessControllerBase
{
    private string? Token => Request.Headers["X-Member-Token"].FirstOrDefault();

    [HttpGet]
    public async Task<IActionResult> Info(string slug, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetPortalInfoQuery(slug), ct));

    [HttpPost("sign-in")]
    [EnableRateLimiting(FitnessRateLimitPolicies.PortalSignIn)]
    public async Task<IActionResult> SignIn(string slug, [FromBody] SignInRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new PortalSignInCommand(slug, req.MemberNumber ?? "", req.Pin ?? ""), ct));

    [HttpPost("change-pin")]
    [EnableRateLimiting(FitnessRateLimitPolicies.PortalSignIn)]
    public async Task<IActionResult> ChangePin(string slug, [FromBody] ChangePinRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new PortalChangePinCommand(slug, Token, req.CurrentPin ?? "", req.NewPin ?? ""), ct));

    [HttpGet("account")]
    public async Task<IActionResult> Account(string slug, [FromQuery] string? today, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetPortalAccountQuery(slug, Token, today), ct));

    [HttpGet("classes")]
    public async Task<IActionResult> Classes(string slug, [FromQuery] string? today, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetPortalClassesQuery(slug, Token, today), ct));

    [HttpPost("bookings")]
    public async Task<IActionResult> Book(string slug, [FromBody] BookRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new PortalBookClassCommand(slug, Token, req.SessionId, req.Today, req.LocalTime), ct));

    [HttpPost("bookings/{id:guid}/cancel")]
    public async Task<IActionResult> Cancel(string slug, Guid id, [FromBody] CancelRequest? req, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new PortalCancelBookingCommand(slug, Token, id, req?.Today, req?.LocalTime), ct));

    public sealed record SignInRequest(string? MemberNumber, string? Pin);
    public sealed record ChangePinRequest(string? CurrentPin, string? NewPin);
    public sealed record BookRequest(Guid SessionId, string? Today, string? LocalTime);
    public sealed record CancelRequest(string? Today, string? LocalTime);
}
