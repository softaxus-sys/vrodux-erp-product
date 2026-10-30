using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Seo.API.Authorization;
using Softaxis.Seo.API.Controllers.Common;
using Softaxis.Seo.Application.Credits;

namespace Softaxis.Seo.API.Controllers;

[ApiController]
[Authorize]
public sealed class SeoCreditsController(ISender sender) : SeoControllerBase
{
    /// <summary>The workspace's SEO credit balance, what a credit buys, and recent movements.</summary>
    [HttpGet("api/seo/credits")]
    [RequirePermission("seo.sites.view")]
    public async Task<IActionResult> Get(CancellationToken ct) => OkOrError(await sender.Send(new GetSeoCreditsQuery(), ct));

    public sealed record GrantRequest(Guid TenantId, int Amount, string Reason);

    /// <summary>Platform administrators only: every workspace's balance.</summary>
    [HttpGet("api/admin/seo/credits")]
    [Authorize(Policy = "SuperAdminOnly")]
    public async Task<IActionResult> Overview(CancellationToken ct) => OkOrError(await sender.Send(new AdminSeoCreditsOverviewQuery(), ct));

    /// <summary>Platform administrators only: one workspace's balance and recent movements.</summary>
    [HttpGet("api/admin/seo/credits/{tenantId:guid}")]
    [Authorize(Policy = "SuperAdminOnly")]
    public async Task<IActionResult> ForTenant(Guid tenantId, CancellationToken ct) => OkOrError(await sender.Send(new AdminTenantSeoCreditsQuery(tenantId), ct));

    /// <summary>Platform administrators only: add or remove credits for a workspace.</summary>
    [HttpPost("api/admin/seo/credits/grant")]
    [Authorize(Policy = "SuperAdminOnly")]
    public async Task<IActionResult> Grant([FromBody] GrantRequest r, CancellationToken ct) =>
        OkOrError(await sender.Send(new AdminGrantSeoCreditsCommand(r.TenantId, r.Amount, r.Reason), ct));
}
