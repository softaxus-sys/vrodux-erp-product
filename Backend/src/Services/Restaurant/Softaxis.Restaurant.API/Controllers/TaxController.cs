using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Restaurant.API.Authorization;
using Softaxis.Restaurant.API.Controllers.Common;
using Softaxis.Restaurant.Application.Tax;

namespace Softaxis.Restaurant.API.Controllers;

/// <summary>Restaurant tax per country / branch, and FBR invoice reporting.</summary>
[ApiController][Route("api/restaurant/tax")][Authorize]
public sealed class TaxController(ISender sender) : RestaurantControllerBase
{
    [HttpGet]
    [RequirePermission("restaurant.tax.view")]
    public async Task<IActionResult> Get(CancellationToken ct) => OkOrError(await sender.Send(new GetTaxSettingsQuery(), ct));

    /// <summary>GET /api/restaurant/tax/current?branchId= — the rate a new bill is charged (till staff).</summary>
    [HttpGet("current")]
    [RequirePermission("restaurant.orders.view")]
    public async Task<IActionResult> Current([FromQuery] Guid? branchId, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetCurrentTaxQuery(branchId), ct));

    /// <summary>PUT /api/restaurant/tax — the workspace setting; PUT /api/restaurant/tax/branches/{id} — one branch.</summary>
    [HttpPut]
    [RequirePermission("restaurant.tax.edit")]
    public async Task<IActionResult> SaveWorkspace([FromBody] TaxProfileReq r, CancellationToken ct) =>
        OkOrError(await sender.Send(r.ToCommand(null), ct));

    [HttpPut("branches/{branchId:guid}")]
    [RequirePermission("restaurant.tax.edit")]
    public async Task<IActionResult> SaveBranch(Guid branchId, [FromBody] TaxProfileReq r, CancellationToken ct) =>
        OkOrError(await sender.Send(r.ToCommand(branchId), ct));

    [HttpDelete("branches/{branchId:guid}")]
    [RequirePermission("restaurant.tax.edit")]
    public async Task<IActionResult> DeleteBranch(Guid branchId, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteBranchTaxProfileCommand(branchId), ct));

    [HttpPost("fbr/test")]
    [RequirePermission("restaurant.tax.edit")]
    public async Task<IActionResult> TestFbr([FromQuery] Guid? branchId, CancellationToken ct) =>
        OkOrError(await sender.Send(new TestFbrConnectionCommand(branchId), ct));

    [HttpGet("fbr/queue")]
    [RequirePermission("restaurant.tax.view")]
    public async Task<IActionResult> Queue([FromQuery] Guid? branchId, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetFbrQueueQuery(branchId), ct));

    [HttpPost("fbr/retry")]
    [RequirePermission("restaurant.tax.edit")]
    public async Task<IActionResult> Retry([FromQuery] Guid? orderId, CancellationToken ct) =>
        OkOrError(await sender.Send(new RetryFbrCommand(orderId), ct));

    public sealed record TaxProfileReq(string CountryCode, string? RegionCode, string TaxLabel, decimal RatePercent,
        bool FbrEnabled, string? FbrEnvironment, int? FbrPosId, string? FbrToken, decimal? FbrServiceFee, string? FbrPctCode)
    {
        public SaveTaxProfileCommand ToCommand(Guid? branchId) => new(branchId, CountryCode, RegionCode, TaxLabel,
            RatePercent, FbrEnabled, FbrEnvironment ?? "sandbox", FbrPosId, FbrToken, FbrServiceFee ?? 1m, FbrPctCode);
    }
}
