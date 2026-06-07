using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.API.Controllers;

[ApiController][Route("api/restaurant/kitchen")][Authorize]
public sealed class KitchenController(RestaurantDbContext db) : ControllerBase
{
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var orders = await db.Orders.AsNoTracking().Where(x => !x.IsDeleted && (x.Status == "sent" || x.Status == "ready"))
            .Select(x => new { x.Status, x.CreatedAt }).ToListAsync(ct);
        var items = await db.OrderItems.AsNoTracking().Where(x => !x.IsDeleted && (x.Status == "pending" || x.Status == "preparing"))
            .Select(x => new { x.Status }).ToListAsync(ct);
        return Ok(new {
            activeOrders = orders.Count,
            sentToKitchen = orders.Count(x => x.Status == "sent"),
            ready = orders.Count(x => x.Status == "ready"),
            pendingItems = items.Count(x => x.Status == "pending"),
            preparingItems = items.Count(x => x.Status == "preparing"),
        });
    }

    [HttpGet("tickets")]
    public async Task<IActionResult> GetTickets(CancellationToken ct)
    {
        var orders = await db.Orders.AsNoTracking().Include(x => x.Items)
            .Where(x => !x.IsDeleted && (x.Status == "sent" || x.Status == "ready"))
            .OrderBy(x => x.CreatedAt).ToListAsync(ct);
        return Ok(orders.Select(o => new {
            o.Id, o.OrderNumber, o.TableNumber, o.Waiter, o.Covers, o.Status, o.CreatedAt,
            waitMinutes = (int)(DateTime.UtcNow - o.CreatedAt).TotalMinutes,
            items = o.Items.Where(i => !i.IsDeleted).Select(i => new {
                i.Id, i.ItemName, i.Quantity, i.Modifiers, i.Status,
            }),
        }));
    }

    [HttpPatch("orders/{id:guid}/ready")]
    public async Task<IActionResult> MarkReady(Guid id, CancellationToken ct)
    {
        var o = await db.Orders.FindAsync([id], ct);
        if (o is null) return NotFound(); o.MarkReady(); await db.SaveChangesAsync(ct);
        return Ok(new { o.Id, o.Status });
    }

    [HttpPatch("items/{id:guid}/status")]
    public async Task<IActionResult> UpdateItemStatus(Guid id, [FromBody] UpdateItemStatusReq req, CancellationToken ct)
    {
        var item = await db.OrderItems.FindAsync([id], ct);
        if (item is null) return NotFound(); item.UpdateStatus(req.Status); await db.SaveChangesAsync(ct);
        return Ok(new { item.Id, item.Status });
    }

    public record UpdateItemStatusReq(string Status);
}
