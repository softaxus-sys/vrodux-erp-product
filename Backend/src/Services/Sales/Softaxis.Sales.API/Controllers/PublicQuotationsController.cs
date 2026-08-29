using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Softaxis.Sales.API.Controllers.Common;
using Softaxis.Sales.Application.Quotations.Commands;

namespace Softaxis.Sales.API.Controllers;

/// <summary>
/// The customer-facing quotation link. Anonymous by necessity — the whole point is that a
/// customer can open and answer a quotation without an account.
///
/// Security posture matches the other anonymous surfaces in this codebase (careers portal, QR
/// table ordering, lead webhooks): the tenant is resolved entirely from an unguessable token —
/// 24 CSPRNG bytes, uniquely indexed — and the response is a deliberately narrowed DTO that
/// omits internal notes, the token itself, and any downstream order or invoice id. There is no
/// authenticated caller here, so [RequirePermission] has nothing to check against.
///
/// Rate limited, because unlike the other anonymous endpoints this one is addressed purely by a
/// secret in the URL and would otherwise be the one place worth brute-forcing.
/// </summary>
[ApiController]
[Route("api/public/quotations")]
[AllowAnonymous]
[EnableCors("PublicWebhook")]
[EnableRateLimiting("public_quotation")]
public sealed class PublicQuotationsController(ISender sender) : SalesControllerBase
{
    /// <summary>Opens the quotation and records the first view.</summary>
    [HttpGet("{token}")]
    public async Task<IActionResult> Get(string token, CancellationToken ct)
        => OkOrError(await sender.Send(new ViewPublicQuotationCommand(token), ct));

    /// <summary>Accept or decline. Idempotent by refusal: a second answer is a 409, not an overwrite.</summary>
    [HttpPost("{token}/respond")]
    public async Task<IActionResult> Respond(string token, [FromBody] RespondBody body, CancellationToken ct)
        => OkOrError(await sender.Send(
            new RespondToPublicQuotationCommand(token, body.Accepted, body.ByName, body.Comment), ct));

    public sealed record RespondBody(bool Accepted, string? ByName, string? Comment);
}
