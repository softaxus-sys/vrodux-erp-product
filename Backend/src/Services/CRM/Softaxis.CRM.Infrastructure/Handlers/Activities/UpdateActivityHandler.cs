using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Application.Notifications;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Abstractions;
using Softaxis.CRM.Application.Activities.Commands;
using Softaxis.CRM.Infrastructure.Persistence;
using Softaxis.CRM.Infrastructure.Services;

namespace Softaxis.CRM.Infrastructure.Handlers.Activities;

internal sealed class UpdateActivityHandler(
    CrmDbContext db, ILeadAccessGuard access, ICurrentUser currentUser, INotificationDispatcher notifications)
    : ICommandHandler<UpdateActivityCommand>
{
    public async Task<Result> Handle(UpdateActivityCommand cmd, CancellationToken ct)
    {
        var a = await db.Activities.FindAsync([cmd.Id], ct);
        if (a is null)
            return Result.Failure(Error.NotFoundById("Activity", cmd.Id));
        if (!await access.CanManageActivityAsync(a.RelatedToType, a.RelatedToId, ct))
            return Result.Failure(Error.NotFoundById("Activity", cmd.Id));

        var previousAssignee = a.AssignedToUserId;

        a.Update(cmd.Type, cmd.Subject, cmd.Description, cmd.DueDate, cmd.AssignedTo, cmd.AssignedToUserId);
        await db.SaveChangesAsync(ct);

        // Only when the assignee actually CHANGED — editing a subject or due date on someone else's
        // task must not re-notify them every time it is saved.
        if (a.AssignedToUserId is { } assignee && assignee != previousAssignee)
            await notifications.PublishAsync(new NotificationRequest(
                RecipientUserId: assignee,
                Module:          NotificationModules.Crm,
                Event:           NotificationEvents.ActivityAssigned,
                Title:           $"{ActivityAlertText.Label(a.Type)} assigned to you",
                Message:         string.IsNullOrWhiteSpace(a.RelatedToName)
                                     ? a.Subject
                                     : $"{a.Subject} — {a.RelatedToName}",
                Link:            ActivityAlertText.LinkFor(a.RelatedToType, a.RelatedToId),
                Type:            "mention",
                RelatedToType:   "activity",
                RelatedToId:     a.Id,
                ActorUserId:     currentUser.Id), ct);

        return Result.Success();
    }
}
