using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Softaxis.Library.API.Authorization;
using Softaxis.Library.API.Controllers.Common;
using Softaxis.Library.API.Extensions;
using Softaxis.Library.Application.Portal;

namespace Softaxis.Library.API.Controllers;

/// <summary>Staff side of the member portal: switching it on, and giving a member a PIN.</summary>
[Route("api/library")][Authorize]
public sealed class PortalAdminController(ISender sender) : LibraryControllerBase
{
    [HttpGet("portal-settings")]
    [RequirePermission("library.setup.view", "library.setup.edit")]
    public async Task<IActionResult> GetSettings(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetPortalSettingsQuery(), ct));

    [HttpPut("portal-settings")]
    [RequirePermission("library.setup.edit")]
    public async Task<IActionResult> UpdateSettings([FromBody] SettingsRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpdatePortalSettingsCommand(
            req.Enabled, req.AllowRenewals, req.AllowReservations, req.PublicCatalogue), ct));

    /// <summary>Gives the member online access. The PIN in the response cannot be read again.</summary>
    [HttpPost("members/{id:guid}/portal-pin")]
    [RequirePermission("library.members.edit")]
    public async Task<IActionResult> SetPin(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new SetMemberPortalPinCommand(id), ct));

    [HttpDelete("members/{id:guid}/portal-pin")]
    [RequirePermission("library.members.edit")]
    public async Task<IActionResult> ClearPin(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new ClearMemberPortalPinCommand(id), ct));

    public sealed record SettingsRequest(bool Enabled, bool AllowRenewals, bool AllowReservations, bool PublicCatalogue);
}

/// <summary>
/// The member portal. No staff sign-in: the workspace comes from the address, and the member from
/// the session they were given at sign-in (the <c>X-Member-Token</c> header). Members are not
/// users of the application and hold none of its permissions.
/// </summary>
[Route("api/library/portal/{slug}")]
[AllowAnonymous]
[EnableRateLimiting(LibraryRateLimitPolicies.Portal)]
public sealed class PortalController(ISender sender) : LibraryControllerBase
{
    private string? Token => Request.Headers["X-Member-Token"].FirstOrDefault();

    [HttpGet]
    public async Task<IActionResult> Info(string slug, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetPortalInfoQuery(slug), ct));

    [HttpPost("sign-in")]
    [EnableRateLimiting(LibraryRateLimitPolicies.PortalSignIn)]
    public async Task<IActionResult> SignIn(string slug, [FromBody] SignInRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new PortalSignInCommand(slug, req.MemberNumber ?? "", req.Pin ?? ""), ct));

    [HttpPost("change-pin")]
    [EnableRateLimiting(LibraryRateLimitPolicies.PortalSignIn)]
    public async Task<IActionResult> ChangePin(string slug, [FromBody] ChangePinRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new PortalChangePinCommand(slug, Token, req.CurrentPin ?? "", req.NewPin ?? ""), ct));

    [HttpGet("account")]
    public async Task<IActionResult> Account(string slug, [FromQuery] string? today, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetPortalAccountQuery(slug, Token, today), ct));

    [HttpGet("search")]
    public async Task<IActionResult> Search(string slug, [FromQuery] string? search, [FromQuery] int page = 1,
        CancellationToken ct = default) =>
        OkOrError(await sender.Send(new PortalSearchQuery(slug, Token, search, page), ct));

    [HttpPost("loans/{id:guid}/renew")]
    public async Task<IActionResult> Renew(string slug, Guid id, [FromBody] TodayRequest? req, CancellationToken ct) =>
        OkOrError(await sender.Send(new PortalRenewCommand(slug, Token, id, req?.Today), ct));

    [HttpPost("reservations")]
    public async Task<IActionResult> Reserve(string slug, [FromBody] ReserveRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new PortalReserveCommand(slug, Token, req.TitleId, req.PickupBranchId, req.Today), ct));

    [HttpPost("reservations/{id:guid}/cancel")]
    public async Task<IActionResult> Cancel(string slug, Guid id, [FromBody] TodayRequest? req, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new PortalCancelReservationCommand(slug, Token, id, req?.Today), ct));

    public sealed record SignInRequest(string? MemberNumber, string? Pin);
    public sealed record ChangePinRequest(string? CurrentPin, string? NewPin);
    public sealed record ReserveRequest(Guid TitleId, Guid PickupBranchId, string? Today);
    public sealed record TodayRequest(string? Today);
}
