using Microsoft.EntityFrameworkCore;
using Softaxis.Restaurant.Domain.Entities;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Common;

/// <summary>
/// Applies a matching HappyHourRule to a freshly-created order as a computed OrderDiscount — a
/// convenience at order-creation time only (not re-evaluated later), so it never retroactively
/// changes a total once the window has closed. Uses server local time (no per-branch timezone model
/// exists yet in this codebase — same documented simplification as ReservationNoShowService).
/// </summary>
internal static class HappyHourApplier
{
    public static async Task ApplyIfMatchingAsync(RestaurantDbContext db, Order order, Guid? appliedByUserId, CancellationToken ct)
    {
        if (appliedByUserId is null || order.Items.Count == 0) return;

        var rules = await db.HappyHourRules.AsNoTracking().Where(r => !r.IsDeleted && r.IsActive).ToListAsync(ct);
        var now = DateTime.Now;
        var rule = rules.Where(r => r.Matches(now, order.BranchId)).OrderBy(r => r.CreatedAt).FirstOrDefault();
        if (rule is null) return;

        decimal baseAmount;
        if (rule.CategoryId is null)
        {
            baseAmount = order.SubTotal;
        }
        else
        {
            var menuItemIds = order.Items.Where(i => !i.IsDeleted).Select(i => i.MenuItemId).Distinct().ToList();
            var categoryByMenuItem = await db.MenuItems.AsNoTracking()
                .Where(m => menuItemIds.Contains(m.Id))
                .ToDictionaryAsync(m => m.Id, m => m.CategoryId, ct);
            baseAmount = order.Items.Where(i => !i.IsDeleted
                    && categoryByMenuItem.TryGetValue(i.MenuItemId, out var catId) && catId == rule.CategoryId)
                .Sum(i => i.LineTotal);
        }
        if (baseAmount <= 0) return;

        var discountAmount = rule.DiscountType == "percentage"
            ? Math.Round(baseAmount * rule.DiscountValue / 100m, 2)
            : Math.Min(rule.DiscountValue, baseAmount);
        if (discountAmount <= 0) return;

        order.ApplyDiscount(rule.DiscountType, discountAmount, $"Happy Hour: {rule.Name}", appliedByUserId.Value);
    }
}
