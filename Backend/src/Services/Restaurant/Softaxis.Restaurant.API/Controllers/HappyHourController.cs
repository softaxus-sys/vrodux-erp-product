using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Restaurant.API.Authorization;
using Softaxis.Restaurant.API.Controllers.Common;
using Softaxis.Restaurant.Application.HappyHour.Commands;
using Softaxis.Restaurant.Application.HappyHour.Queries;

namespace Softaxis.Restaurant.API.Controllers;

// No dedicated permission group — happy-hour pricing config gates on `restaurant.menu.*`
// (nearest-seeded-key convention; it's menu/pricing configuration, not a distinct resource).
[ApiController][Route("api/restaurant/happy-hour-rules")][Authorize]
public sealed class HappyHourController(ISender sender) : RestaurantControllerBase
{
    [HttpGet]
    [RequirePermission("restaurant.menu.view")]
    public async Task<IActionResult> GetAll(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetHappyHourRulesQuery(), ct));

    [HttpPost]
    [RequirePermission("restaurant.menu.edit")]
    public async Task<IActionResult> Create([FromBody] CreateHappyHourRuleCommand cmd, CancellationToken ct) =>
        OkOrError(await sender.Send(cmd, ct));

    [HttpPut("{id:guid}")]
    [RequirePermission("restaurant.menu.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateHappyHourRuleReq req, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpdateHappyHourRuleCommand(id, req.Name, req.DaysOfWeekMask, req.StartTime,
            req.EndTime, req.DiscountType, req.DiscountValue, req.CategoryId, req.IsActive), ct));

    [HttpDelete("{id:guid}")]
    [RequirePermission("restaurant.menu.edit")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteHappyHourRuleCommand(id), ct));

    public record UpdateHappyHourRuleReq(string Name, int DaysOfWeekMask, string StartTime, string EndTime,
        string DiscountType, decimal DiscountValue, Guid? CategoryId, bool IsActive);
}
