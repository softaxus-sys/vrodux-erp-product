using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.Notifications;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Notifications;

/// <summary>
/// HR's alerts, in one place so the leave and payroll handlers stay about leave and payroll.
///
/// <para>Two shapes here, and the difference matters. A DECISION (leave approved, payroll rejected)
/// has exactly one recipient — the person waiting on it — reached through
/// <c>Employee.UserId</c>, which is null for staff with no login. A SUBMISSION (leave requested,
/// payroll awaiting Finance) has no single recipient at all: it goes to whoever holds the permission
/// to action it, which differs per workspace, so it is resolved from Identity at send time.</para>
/// </summary>
internal static class HrAlerts
{
    /// <summary>
    /// Tells everyone who can action it that something is waiting. No-ops when the tenant is
    /// unresolved (a background context), since there would be no workspace to resolve roles against.
    /// </summary>
    public static async Task NotifyQueueAsync(
        INotificationDispatcher dispatcher, INotificationRecipients recipients,
        string permissionKey, string module, string eventKey, string type,
        string title, string message, string link, string relatedToType, Guid relatedToId,
        Guid? actorUserId, CancellationToken ct)
    {
        if (TenantAmbient.TenantId is not { } tenantId) return;

        var userIds = await recipients.WithPermissionAsync(tenantId, permissionKey, ct);
        if (userIds.Count == 0) return;

        await dispatcher.PublishManyAsync(userIds.Select(id => new NotificationRequest(
            RecipientUserId: id,
            Module:          module,
            Event:           eventKey,
            Title:           title,
            Message:         message,
            Link:            link,
            Type:            type,
            RelatedToType:   relatedToType,
            RelatedToId:     relatedToId,
            ActorUserId:     actorUserId)), ct);
    }

    /// <summary>
    /// Tells one employee the outcome of something they submitted. Silently does nothing when the
    /// employee has no linked login — plenty of staff are recorded in HR without ever being given
    /// one, and that is not an error worth failing an approval over.
    /// </summary>
    public static async Task NotifyEmployeeAsync(
        HrDbContext db, INotificationDispatcher dispatcher,
        Guid employeeId, string eventKey, string type, string title, string message,
        string link, string relatedToType, Guid relatedToId, Guid? actorUserId, CancellationToken ct)
    {
        var userId = await db.Employees.AsNoTracking()
            .Where(e => e.Id == employeeId)
            .Select(e => e.UserId)
            .FirstOrDefaultAsync(ct);
        if (userId is not { } uid) return;

        await dispatcher.PublishAsync(new NotificationRequest(
            RecipientUserId: uid,
            Module:          NotificationModules.Hr,
            Event:           eventKey,
            Title:           title,
            Message:         message,
            Link:            link,
            Type:            type,
            RelatedToType:   relatedToType,
            RelatedToId:     relatedToId,
            ActorUserId:     actorUserId), ct);
    }
}
