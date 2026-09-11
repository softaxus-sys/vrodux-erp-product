using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Abstractions;
using Softaxis.CRM.Application.Notifications.Commands;
using Softaxis.CRM.Application.Notifications.Dtos;
using Softaxis.CRM.Application.Notifications.Queries;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Notifications;

// Every handler here reads only the caller's OWN rows (UserId == current user), on top of the tenant
// query filter — a notification is never visible to anyone but the person it was raised for.

internal sealed class GetMyNotificationsHandler(CrmDbContext db, ICurrentUser currentUser)
    : IQueryHandler<GetMyNotificationsQuery, MyNotificationsDto>
{
    public async Task<Result<MyNotificationsDto>> Handle(GetMyNotificationsQuery query, CancellationToken ct)
    {
        if (currentUser.Id is not { } me)
            return Result.Success(new MyNotificationsDto([], 0));

        var take = Math.Clamp(query.Take, 1, 100);
        var mine = db.Notifications.AsNoTracking().Where(n => n.UserId == me);

        var items = await mine
            .OrderByDescending(n => n.CreatedAt)
            .Take(take)
            .Select(n => new CrmNotificationDto(
                n.Id, n.Type, n.Title, n.Message, n.Link, n.RelatedToType, n.RelatedToId,
                n.ReadAt != null, n.CreatedAt))
            .ToListAsync(ct);

        var unread = await mine.CountAsync(n => n.ReadAt == null, ct);
        return Result.Success(new MyNotificationsDto(items, unread));
    }
}

internal sealed class MarkNotificationReadHandler(CrmDbContext db, ICurrentUser currentUser)
    : ICommandHandler<MarkNotificationReadCommand>
{
    public async Task<Result> Handle(MarkNotificationReadCommand cmd, CancellationToken ct)
    {
        if (currentUser.Id is not { } me)
            return Result.Failure(Error.Custom("Notification.NotFound", "Notification not found."));

        var n = await db.Notifications.FirstOrDefaultAsync(x => x.Id == cmd.Id && x.UserId == me, ct);
        if (n is null)
            return Result.Failure(Error.Custom("Notification.NotFound", "Notification not found."));

        n.MarkRead();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class MarkAllNotificationsReadHandler(CrmDbContext db, ICurrentUser currentUser)
    : ICommandHandler<MarkAllNotificationsReadCommand>
{
    public async Task<Result> Handle(MarkAllNotificationsReadCommand cmd, CancellationToken ct)
    {
        if (currentUser.Id is not { } me) return Result.Success();

        var unread = await db.Notifications.Where(x => x.UserId == me && x.ReadAt == null).ToListAsync(ct);
        foreach (var n in unread) n.MarkRead();
        if (unread.Count > 0) await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
