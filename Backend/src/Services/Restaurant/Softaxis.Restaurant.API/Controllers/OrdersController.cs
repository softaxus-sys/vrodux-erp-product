using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Softaxis.Restaurant.Domain.Entities;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.API.Controllers;

[ApiController][Route("api/restaurant/orders")][Authorize]
public sealed class OrdersController(RestaurantDbContext db) : ControllerBase
{
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var today = DateTime.UtcNow.Date;
        var all = await db.Orders.AsNoTracking().Where(x => !x.IsDeleted)
            .Select(x => new { x.Status, x.Total, x.OrderType, x.CreatedAt }).ToListAsync(ct);
        var todayOrders = all.Where(x => x.CreatedAt >= today).ToList();
        return Ok(new {
            total = all.Count,
            open      = all.Count(x => x.Status == "open"),
            sent      = all.Count(x => x.Status == "sent"),
            ready     = all.Count(x => x.Status == "ready"),
            served    = all.Count(x => x.Status == "served"),
            paid      = all.Count(x => x.Status == "paid"),
            cancelled = all.Count(x => x.Status == "cancelled"),
            todayOrders = todayOrders.Count,
            todayRevenue = todayOrders.Where(x => x.Status == "paid").Sum(x => x.Total),
            totalRevenue = all.Where(x => x.Status == "paid").Sum(x => x.Total),
        });
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? status, CancellationToken ct)
    {
        var q = db.Orders.AsNoTracking().Include(x => x.Items).Where(x => !x.IsDeleted);
        if (!string.IsNullOrEmpty(status)) q = q.Where(x => x.Status == status);
        var items = await q.OrderByDescending(x => x.CreatedAt).ToListAsync(ct);
        return Ok(items.Select(ToDto));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var o = await db.Orders.AsNoTracking().Include(x => x.Items)
            .FirstOrDefaultAsync(x => x.Id == id, ct);
        return o is null ? NotFound() : Ok(ToDto(o));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateOrderReq req, CancellationToken ct)
    {
        // Takeaway / delivery orders are not tied to a table.
        var isTableOrder = req.OrderType == "dine_in" && req.TableId.HasValue && req.TableId.Value != Guid.Empty;

        Order order;
        Table? table = null;
        if (isTableOrder)
        {
            table = await db.Tables.FindAsync([req.TableId!.Value], ct);
            if (table is null) return NotFound("Table not found");
            order = new Order(table.Id, table.TableNumber, req.Waiter, req.Covers, "dine_in", req.Notes);
        }
        else
        {
            var label = req.OrderType == "delivery" ? "Delivery" : "Takeaway";
            order = new Order(Guid.Empty, label, req.Waiter, req.Covers,
                req.OrderType == "delivery" ? "delivery" : "takeaway", req.Notes);
        }

        foreach (var li in req.Items)
        {
            var menuItem = await db.MenuItems.FindAsync([li.MenuItemId], ct);
            if (menuItem is null) continue;
            var oi = new OrderItem(order.Id, li.MenuItemId, menuItem.Name, li.Quantity, menuItem.Price, li.Modifiers);
            order.Items.Add(oi);
        }
        order.Recalculate();
        table?.Occupy(order.Id, req.Waiter);

        db.Orders.Add(order);
        await db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(GetById), new { id = order.Id }, ToDto(order));
    }

    [HttpPost("{id:guid}/items")]
    public async Task<IActionResult> AddItems(Guid id, [FromBody] AddItemsReq req, CancellationToken ct)
    {
        var order = await db.Orders.Include(x => x.Items).FirstOrDefaultAsync(x => x.Id == id, ct);
        if (order is null) return NotFound();
        if (order.Status is "paid" or "cancelled")
            return BadRequest("Cannot modify a closed order.");

        foreach (var li in req.Items)
        {
            var menuItem = await db.MenuItems.FindAsync([li.MenuItemId], ct);
            if (menuItem is null) continue;
            order.Items.Add(new OrderItem(order.Id, li.MenuItemId, menuItem.Name, li.Quantity, menuItem.Price, li.Modifiers));
        }
        order.Recalculate();
        await db.SaveChangesAsync(ct);
        return Ok(ToDto(order));
    }

    [HttpDelete("{id:guid}/items/{itemId:guid}")]
    public async Task<IActionResult> RemoveItem(Guid id, Guid itemId, CancellationToken ct)
    {
        var order = await db.Orders.Include(x => x.Items).FirstOrDefaultAsync(x => x.Id == id, ct);
        if (order is null) return NotFound();
        if (order.Status is "paid" or "cancelled")
            return BadRequest("Cannot modify a closed order.");

        var item = order.Items.FirstOrDefault(i => i.Id == itemId && !i.IsDeleted);
        if (item is null) return NotFound("Item not found.");
        item.Delete();
        order.Recalculate();
        await db.SaveChangesAsync(ct);
        return Ok(ToDto(order));
    }

    [HttpPatch("{id:guid}/discount")]
    public async Task<IActionResult> ApplyDiscount(Guid id, [FromBody] DiscountReq req, CancellationToken ct)
    {
        var o = await db.Orders.Include(x => x.Items).FirstOrDefaultAsync(x => x.Id == id, ct);
        if (o is null) return NotFound();
        o.ApplyDiscount(Math.Max(0, req.Amount));
        await db.SaveChangesAsync(ct);
        return Ok(ToDto(o));
    }

    [HttpPatch("{id:guid}/send")]
    public async Task<IActionResult> SendToKitchen(Guid id, CancellationToken ct)
    {
        var o = await db.Orders.FindAsync([id], ct);
        if (o is null) return NotFound(); o.SendToKitchen(); await db.SaveChangesAsync(ct);
        return Ok(new { o.Id, o.Status });
    }

    [HttpPatch("{id:guid}/ready")]
    public async Task<IActionResult> MarkReady(Guid id, CancellationToken ct)
    {
        var o = await db.Orders.FindAsync([id], ct);
        if (o is null) return NotFound(); o.MarkReady(); await db.SaveChangesAsync(ct);
        return Ok(new { o.Id, o.Status });
    }

    [HttpPatch("{id:guid}/serve")]
    public async Task<IActionResult> Serve(Guid id, CancellationToken ct)
    {
        var o = await db.Orders.FindAsync([id], ct);
        if (o is null) return NotFound(); o.Serve(); await db.SaveChangesAsync(ct);
        return Ok(new { o.Id, o.Status });
    }

    [HttpPatch("{id:guid}/pay")]
    public async Task<IActionResult> Pay(Guid id, [FromBody] PayReq req, CancellationToken ct)
    {
        var o = await db.Orders.AsNoTracking().Include(x => x.Payments).FirstOrDefaultAsync(x => x.Id == id, ct);
        if (o is null) return NotFound();
        if (o.Status == "cancelled") return BadRequest("Order is cancelled.");
        var due = Math.Max(o.Outstanding, o.Total - o.AmountPaid);
        if (due <= 0) due = o.Total;
        return await RecordPayment(id, req.Method, due, null, ct);
    }

    /// <summary>
    /// Record a (possibly partial) payment — supports split-tender (multiple
    /// methods) and split-bill (multiple member payments). Frees the table once
    /// the order is fully paid.
    /// </summary>
    [HttpPost("{id:guid}/payments")]
    public async Task<IActionResult> AddPayment(Guid id, [FromBody] AddPaymentReq req, CancellationToken ct)
    {
        if (req.Amount <= 0) return BadRequest("Amount must be greater than zero.");
        return await RecordPayment(id, req.Method, req.Amount, req.Reference, ct);
    }

    /// <summary>
    /// Writes a payment using direct SQL (no EF change-tracking) so the operation
    /// is immune to optimistic-concurrency rowcount issues, then frees the table.
    /// </summary>
    private async Task<IActionResult> RecordPayment(Guid id, string method, decimal amount, string? reference, CancellationToken ct)
    {
        var o = await db.Orders.AsNoTracking().Include(x => x.Payments).FirstOrDefaultAsync(x => x.Id == id, ct);
        if (o is null) return NotFound();
        if (o.Status == "cancelled") return BadRequest("Order is cancelled.");

        var newPaid    = o.AmountPaid + amount;
        var fullyPaid  = newPaid >= o.Total - 0.01m;
        var distinct   = o.Payments.Select(p => p.Method).Append(method).Distinct().Count();
        var methodLbl  = distinct > 1 ? "Split" : method;
        var status     = fullyPaid ? "paid" : o.Status;
        var now        = DateTime.UtcNow;

        await db.Database.ExecuteSqlAsync(
            $"INSERT INTO [restaurant].[OrderPayments] ([Id],[OrderId],[Method],[Amount],[Reference],[CreatedAt]) VALUES ({Guid.NewGuid()},{id},{method},{amount},{reference},{now})", ct);

        await db.Database.ExecuteSqlAsync(
            $"UPDATE [restaurant].[Orders] SET [AmountPaid]={newPaid}, [PaymentMethod]={methodLbl}, [Status]={status}, [UpdatedAt]={now} WHERE [Id]={id}", ct);

        if (fullyPaid && o.TableId != Guid.Empty)
            await db.Database.ExecuteSqlAsync(
                $"UPDATE [restaurant].[Tables] SET [Status]='cleaning', [CurrentOrderId]=NULL, [CurrentWaiter]=NULL, [OccupiedSince]=NULL, [UpdatedAt]={now} WHERE [Id]={o.TableId}", ct);

        var fresh = await db.Orders.AsNoTracking().Include(x => x.Items).Include(x => x.Payments).FirstOrDefaultAsync(x => x.Id == id, ct);
        return Ok(ToDto(fresh!));
    }

    [HttpPatch("{id:guid}/cancel")]
    public async Task<IActionResult> Cancel(Guid id, CancellationToken ct)
    {
        var o = await db.Orders.FindAsync([id], ct);
        if (o is null) return NotFound(); o.Cancel(); await db.SaveChangesAsync(ct);
        return Ok(new { o.Id, o.Status });
    }

    private static object ToDto(Order o) => new {
        o.Id, o.OrderNumber, o.TableId, o.TableNumber, o.Waiter, o.Covers,
        o.Status, o.OrderType, o.SubTotal, o.TaxAmount, o.DiscountAmount, o.Total,
        o.AmountPaid, outstanding = o.Outstanding,
        o.PaymentMethod, o.Notes, o.CreatedAt,
        items = o.Items.Where(i => !i.IsDeleted).Select(i => new {
            i.Id, i.MenuItemId, i.ItemName, i.Quantity, i.UnitPrice,
            lineTotal = i.LineTotal, i.Modifiers, i.Status,
        }),
        payments = o.Payments.OrderBy(p => p.CreatedAt).Select(p => new {
            p.Id, p.Method, p.Amount, p.Reference, p.CreatedAt,
        }),
    };

    public record CreateOrderReq(Guid? TableId, string Waiter, int Covers, string OrderType,
        string? Notes, List<OrderLineReq> Items);
    public record OrderLineReq(Guid MenuItemId, int Quantity, string? Modifiers);
    public record AddItemsReq(List<OrderLineReq> Items);
    public record DiscountReq(decimal Amount);
    public record PayReq(string Method);
    public record AddPaymentReq(string Method, decimal Amount, string? Reference);
}
