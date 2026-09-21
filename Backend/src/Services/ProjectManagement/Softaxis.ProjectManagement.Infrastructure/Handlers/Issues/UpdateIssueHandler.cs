using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Application.Notifications;
using Softaxis.ProjectManagement.Application.Abstractions;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.ProjectManagement.Application.Issues.Commands;
using Softaxis.ProjectManagement.Application.Issues.Dtos;
using Softaxis.ProjectManagement.Domain.Entities;
using Softaxis.ProjectManagement.Infrastructure.Persistence;

namespace Softaxis.ProjectManagement.Infrastructure.Handlers.Issues;

internal sealed class UpdateIssueHandler(
    ProjectManagementDbContext db, ICurrentUser currentUser, INotificationDispatcher notifications)
    : ICommandHandler<UpdateIssueCommand, IssueDto>
{
    public async Task<Result<IssueDto>> Handle(UpdateIssueCommand cmd, CancellationToken ct)
    {
        var entity = await db.Issues.FindAsync([cmd.Id], ct);
        var previousAssignee = entity?.AssigneeId;
        if (entity is null)
            return Result.Failure<IssueDto>(Error.NotFoundById(nameof(Issue), cmd.Id));

        entity.UpdateDetails(
            cmd.Title, cmd.Description, cmd.Type, cmd.Priority,
            cmd.AssigneeName, cmd.AssigneeId, cmd.EpicId, cmd.StoryPoints, cmd.DueDate);

        if (cmd.LabelIds is not null)
        {
            var existing = await db.IssueLabels.Where(x => x.IssueId == entity.Id).ToListAsync(ct);
            db.IssueLabels.RemoveRange(existing);

            foreach (var labelId in cmd.LabelIds.Distinct())
                db.IssueLabels.Add(new IssueLabel(entity.Id, labelId));
        }

        await db.SaveChangesAsync(ct);


        // Someone told to pick this up needs to know without watching the board. Assigning to
        // yourself raises nothing.
        if (entity.AssigneeId is { } assignee && assignee != currentUser.Id && assignee != previousAssignee)
            await notifications.PublishAsync(new NotificationRequest(
                RecipientUserId: assignee,
                Module:          NotificationModules.ProjectManagement,
                Event:           NotificationEvents.IssueAssigned,
                Title:           "Issue assigned to you",
                Message:         $"{entity.IssueKey} — {entity.Title}",
                Link:            $"/project-management/issues?issue={entity.Id}",
                Type:            "mention",
                RelatedToType:   "issue",
                RelatedToId:     entity.Id,
                ActorUserId:     currentUser.Id), ct);
        var dto = await IssueMappings.LoadDtoAsync(db, entity.Id, ct);
        return Result.Success(dto!);
    }
}
