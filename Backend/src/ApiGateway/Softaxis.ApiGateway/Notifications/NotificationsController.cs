using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.Notifications;
using Softaxis.BuildingBlocks.Infrastructure.Notifications;
using Softaxis.Identity.Application.Abstractions;

namespace Softaxis.ApiGateway.Notifications;

/// <summary>
/// The signed-in user's own notification feed, across every module.
///
/// <para>No permission attribute, and none is needed: every query is pinned to
/// <c>UserId == caller</c> on top of the tenant filter, so there is nothing reachable here that was
/// not already this person's. What IS applied is a module gate — alerts from a module the reader can
/// no longer open are hidden (see <see cref="NotificationModuleAccess"/>).</para>
///
/// <para>Hosted by the gateway rather than a service because the feed spans all of them; the gateway
/// is the only place that already sees every module's licence state.</para>
/// </summary>
[ApiController]
[Route("api/notifications")]
[Authorize]
public sealed class NotificationsController(
    NotificationsDbContext db,
    ITenantContext tenant,
    INotificationRealtimeNotifier realtime) : ControllerBase
{
    public sealed record NotificationDto(
        Guid Id, string Module, string Event, string Type, string Title, string Message,
        string? Link, string? RelatedToType, Guid? RelatedToId, bool Read, DateTime CreatedAt);

    public sealed record FeedDto(IReadOnlyList<NotificationDto> Items, int UnreadCount);

    [HttpGet]
    public async Task<IActionResult> GetMine([FromQuery] int take = 50, [FromQuery] string? module = null,
        [FromQuery] bool unreadOnly = false, CancellationToken ct = default)
    {
        if (CurrentUserId() is not { } me) return Ok(new FeedDto([], 0));

        var mine = Visible(me);
        if (unreadOnly) mine = mine.Where(n => n.ReadAt == null);
        if (!string.IsNullOrWhiteSpace(module)) mine = mine.Where(n => n.Module == module);

        var items = await mine
            .OrderByDescending(n => n.CreatedAt)
            .Take(Math.Clamp(take, 1, 100))
            .Select(n => new NotificationDto(n.Id, n.Module, n.Event, n.Type, n.Title, n.Message,
                n.Link, n.RelatedToType, n.RelatedToId, n.ReadAt != null, n.CreatedAt))
            .ToListAsync(ct);

        // Counted over the unfiltered visible set: the badge means "unread anywhere", so it must not
        // drop just because the panel happens to be filtered to one module.
        var unread = await Visible(me).CountAsync(n => n.ReadAt == null, ct);
        return Ok(new FeedDto(items, unread));
    }

    /// <summary>Per-module unread tallies, for the panel's filter chips.</summary>
    [HttpGet("summary")]
    public async Task<IActionResult> Summary(CancellationToken ct)
    {
        if (CurrentUserId() is not { } me) return Ok(Array.Empty<object>());

        var rows = await Visible(me)
            .Where(n => n.ReadAt == null)
            .GroupBy(n => n.Module)
            .Select(g => new { Module = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        return Ok(rows);
    }

    [HttpPost("{id:guid}/read")]
    public async Task<IActionResult> MarkRead(Guid id, CancellationToken ct)
    {
        if (CurrentUserId() is not { } me) return NoContent();

        var n = await db.Notifications.FirstOrDefaultAsync(x => x.Id == id && x.UserId == me, ct);
        if (n is null) return NotFound(new { Code = "Notification.NotFound", Description = "Notification not found." });

        n.MarkRead();
        await db.SaveChangesAsync(ct);
        await PushReadStateAsync(me, ct);
        return NoContent();
    }

    [HttpPost("read-all")]
    public async Task<IActionResult> MarkAllRead(CancellationToken ct)
    {
        if (CurrentUserId() is not { } me) return NoContent();

        // Set-based: a long-unread bell can hold hundreds of rows, and loading them only to flip one
        // column each is a round trip per row for no benefit.
        await db.Notifications
            .Where(n => n.UserId == me && n.ReadAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(n => n.ReadAt, DateTime.UtcNow), ct);

        await PushReadStateAsync(me, ct);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Dismiss(Guid id, CancellationToken ct)
    {
        if (CurrentUserId() is not { } me) return NoContent();

        await db.Notifications.Where(n => n.Id == id && n.UserId == me).ExecuteDeleteAsync(ct);
        await PushReadStateAsync(me, ct);
        return NoContent();
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    /// <summary>The caller's own rows, minus any module they can no longer open.</summary>
    private IQueryable<Softaxis.BuildingBlocks.Domain.Notifications.Notification> Visible(Guid me)
    {
        var q = db.Notifications.AsNoTracking().Where(n => n.UserId == me);
        if (tenant.IsSuperAdmin) return q;

        var allowed = NotificationModuleAccess.VisibleModules(tenant);
        // An unmapped module (Support, System, or one added later) is always visible — a new module's
        // alerts must not disappear just because the access table was not updated for it.
        var gated = NotificationModuleAccess.GatedModules;
        return q.Where(n => !gated.Contains(n.Module) || allowed.Contains(n.Module));
    }

    /// <summary>Keeps this user's other open tabs' badges in step after a read here.</summary>
    private async Task PushReadStateAsync(Guid me, CancellationToken ct)
    {
        if (tenant.TenantId is not { } tenantId) return;
        var unread = await Visible(me).CountAsync(n => n.ReadAt == null, ct);
        await realtime.PushReadStateAsync(tenantId, me, unread, ct);
    }

    private Guid? CurrentUserId()
    {
        var raw = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(raw, out var id) ? id : null;
    }
}
