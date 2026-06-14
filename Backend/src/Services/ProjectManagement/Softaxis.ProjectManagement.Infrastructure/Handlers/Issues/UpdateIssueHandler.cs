using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.ProjectManagement.Application.Issues.Commands;
using Softaxis.ProjectManagement.Application.Issues.Dtos;
using Softaxis.ProjectManagement.Domain.Entities;
using Softaxis.ProjectManagement.Infrastructure.Persistence;

namespace Softaxis.ProjectManagement.Infrastructure.Handlers.Issues;

internal sealed class UpdateIssueHandler(ProjectManagementDbContext db)
    : ICommandHandler<UpdateIssueCommand, IssueDto>
{
    public async Task<Result<IssueDto>> Handle(UpdateIssueCommand cmd, CancellationToken ct)
    {
        var entity = await db.Issues.FindAsync([cmd.Id], ct);
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

        var dto = await IssueMappings.LoadDtoAsync(db, entity.Id, ct);
        return Result.Success(dto!);
    }
}
