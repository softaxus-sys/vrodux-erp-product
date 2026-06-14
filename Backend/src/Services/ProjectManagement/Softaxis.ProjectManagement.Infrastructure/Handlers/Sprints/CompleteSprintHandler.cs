using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.ProjectManagement.Application.Sprints.Commands;
using Softaxis.ProjectManagement.Application.Sprints.Dtos;
using Softaxis.ProjectManagement.Domain.Entities;
using Softaxis.ProjectManagement.Infrastructure.Persistence;

namespace Softaxis.ProjectManagement.Infrastructure.Handlers.Sprints;

internal sealed class CompleteSprintHandler(ProjectManagementDbContext db)
    : ICommandHandler<CompleteSprintCommand, SprintDto>
{
    public async Task<Result<SprintDto>> Handle(CompleteSprintCommand cmd, CancellationToken ct)
    {
        var entity = await db.Sprints.FindAsync([cmd.Id], ct);
        if (entity is null)
            return Result.Failure<SprintDto>(Error.NotFoundById(nameof(Sprint), cmd.Id));

        // Move any unresolved issues back to the backlog so they aren't lost.
        var openIssues = await db.Issues
            .Where(x => x.SprintId == entity.Id && x.ResolvedAt == null)
            .ToListAsync(ct);

        foreach (var issue in openIssues)
            issue.SetSprint(null, issue.SortOrder);

        entity.Complete();
        await db.SaveChangesAsync(ct);

        var issueCount = await db.Issues.CountAsync(x => x.SprintId == entity.Id, ct);
        return Result.Success(CreateSprintHandler.ToDto(entity, issueCount));
    }
}
