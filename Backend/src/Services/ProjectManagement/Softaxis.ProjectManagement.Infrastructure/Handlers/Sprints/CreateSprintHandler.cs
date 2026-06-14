using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.ProjectManagement.Application.Sprints.Commands;
using Softaxis.ProjectManagement.Application.Sprints.Dtos;
using Softaxis.ProjectManagement.Domain.Entities;
using Softaxis.ProjectManagement.Infrastructure.Persistence;

namespace Softaxis.ProjectManagement.Infrastructure.Handlers.Sprints;

internal sealed class CreateSprintHandler(ProjectManagementDbContext db)
    : ICommandHandler<CreateSprintCommand, SprintDto>
{
    public async Task<Result<SprintDto>> Handle(CreateSprintCommand cmd, CancellationToken ct)
    {
        var projectExists = await db.Projects.AnyAsync(x => x.Id == cmd.ProjectId, ct);
        if (!projectExists)
            return Result.Failure<SprintDto>(Error.NotFoundById(nameof(Project), cmd.ProjectId));

        var maxSortOrder = await db.Sprints
            .Where(x => x.ProjectId == cmd.ProjectId)
            .Select(x => (int?)x.SortOrder)
            .MaxAsync(ct);

        var entity = new Sprint(cmd.ProjectId, cmd.Name, cmd.Goal, cmd.StartDate, cmd.EndDate, (maxSortOrder ?? -1) + 1);

        db.Sprints.Add(entity);
        await db.SaveChangesAsync(ct);

        return Result.Success(ToDto(entity, 0));
    }

    internal static SprintDto ToDto(Sprint s, int issueCount) =>
        new(s.Id, s.ProjectId, s.Name, s.Goal, s.StartDate, s.EndDate, s.Status, s.SortOrder, issueCount);
}
