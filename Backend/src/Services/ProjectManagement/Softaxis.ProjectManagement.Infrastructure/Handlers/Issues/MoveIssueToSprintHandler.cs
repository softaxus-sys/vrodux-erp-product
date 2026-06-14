using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.ProjectManagement.Application.Issues.Commands;
using Softaxis.ProjectManagement.Application.Issues.Dtos;
using Softaxis.ProjectManagement.Domain.Entities;
using Softaxis.ProjectManagement.Infrastructure.Persistence;

namespace Softaxis.ProjectManagement.Infrastructure.Handlers.Issues;

internal sealed class MoveIssueToSprintHandler(ProjectManagementDbContext db)
    : ICommandHandler<MoveIssueToSprintCommand, IssueDto>
{
    public async Task<Result<IssueDto>> Handle(MoveIssueToSprintCommand cmd, CancellationToken ct)
    {
        var entity = await db.Issues.FindAsync([cmd.Id], ct);
        if (entity is null)
            return Result.Failure<IssueDto>(Error.NotFoundById(nameof(Issue), cmd.Id));

        if (cmd.SprintId.HasValue)
        {
            var sprint = await db.Sprints.FindAsync([cmd.SprintId.Value], ct);
            if (sprint is null || sprint.ProjectId != entity.ProjectId)
                return Result.Failure<IssueDto>(Error.NotFoundById(nameof(Sprint), cmd.SprintId.Value));
        }

        entity.SetSprint(cmd.SprintId, cmd.SortOrder);
        await db.SaveChangesAsync(ct);

        var dto = await IssueMappings.LoadDtoAsync(db, entity.Id, ct);
        return Result.Success(dto!);
    }
}
