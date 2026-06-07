using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.API.Controllers;

[ApiController][Route("api/restaurant/menu")][Authorize]
public sealed class MenuController(RestaurantDbContext db) : ControllerBase
{
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var categories = await db.MenuCategories.AsNoTracking().Where(x => !x.IsDeleted).CountAsync(ct);
        var items = await db.MenuItems.AsNoTracking().Where(x => !x.IsDeleted)
            .Select(x => new { x.IsAvailable, x.Price }).ToListAsync(ct);
        return Ok(new {
            totalCategories = categories,
            totalItems = items.Count,
            availableItems = items.Count(x => x.IsAvailable),
            unavailableItems = items.Count(x => !x.IsAvailable),
            avgPrice = items.Any() ? Math.Round(items.Average(x => (double)x.Price), 2) : 0,
            minPrice = items.Any() ? items.Min(x => x.Price) : 0,
            maxPrice = items.Any() ? items.Max(x => x.Price) : 0,
        });
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var cats = await db.MenuCategories.AsNoTracking().Include(x => x.Items)
            .Where(x => !x.IsDeleted).OrderBy(x => x.SortOrder).ToListAsync(ct);
        return Ok(cats.Select(c => new {
            c.Id, c.Name, c.Description, c.SortOrder, c.IsActive,
            items = c.Items.Where(i => !i.IsDeleted).Select(i => new {
                i.Id, i.Name, i.Description, i.Price, i.PrepTimeMinutes, i.Allergens, i.IsAvailable,
            }),
        }));
    }

    [HttpGet("items")]
    public async Task<IActionResult> GetItems([FromQuery] Guid? categoryId, CancellationToken ct)
    {
        var q = db.MenuItems.AsNoTracking().Where(x => !x.IsDeleted);
        if (categoryId.HasValue) q = q.Where(x => x.CategoryId == categoryId.Value);
        var items = await q.OrderBy(x => x.Name).ToListAsync(ct);
        return Ok(items.Select(i => new {
            i.Id, i.CategoryId, i.Name, i.Description, i.Price, i.PrepTimeMinutes, i.Allergens, i.IsAvailable,
        }));
    }

    [HttpPatch("items/{id:guid}/availability")]
    public async Task<IActionResult> SetAvailability(Guid id, [FromBody] SetAvailabilityReq req, CancellationToken ct)
    {
        var item = await db.MenuItems.FindAsync([id], ct);
        if (item is null) return NotFound();
        item.SetAvailability(req.IsAvailable);
        await db.SaveChangesAsync(ct);
        return Ok(new { item.Id, item.IsAvailable });
    }

    [HttpPost("categories")]
    public async Task<IActionResult> CreateCategory([FromBody] CreateCategoryReq req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Name)) return BadRequest("Name is required.");
        var cat = new Softaxis.Restaurant.Domain.Entities.MenuCategory(req.Name.Trim(), req.Description, req.SortOrder);
        db.MenuCategories.Add(cat);
        await db.SaveChangesAsync(ct);
        return Ok(new { cat.Id, cat.Name, cat.Description, cat.SortOrder });
    }

    [HttpPost("items")]
    public async Task<IActionResult> CreateItem([FromBody] CreateItemReq req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Name)) return BadRequest("Name is required.");
        if (req.Price < 0) return BadRequest("Price cannot be negative.");
        var catExists = await db.MenuCategories.AnyAsync(c => c.Id == req.CategoryId && !c.IsDeleted, ct);
        if (!catExists) return BadRequest("Category not found.");

        var item = new Softaxis.Restaurant.Domain.Entities.MenuItem(
            req.CategoryId, req.Name.Trim(), req.Description, req.Price, req.PrepTimeMinutes, req.Allergens);
        db.MenuItems.Add(item);
        await db.SaveChangesAsync(ct);
        return Ok(new { item.Id, item.CategoryId, item.Name, item.Price, item.PrepTimeMinutes, item.IsAvailable });
    }

    public record SetAvailabilityReq(bool IsAvailable);
    public record CreateCategoryReq(string Name, string? Description, int SortOrder);
    public record CreateItemReq(Guid CategoryId, string Name, string? Description, decimal Price, int PrepTimeMinutes, string? Allergens);
}
