using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.ProjectManagement.Application.Sprints.Commands;
using Softaxis.ProjectManagement.Application.Sprints.Dtos;
using Softaxis.ProjectManagement.Domain.Entities;
using Softaxis.ProjectManagement.Infrastructure.Persistence;

namespace Softaxis.ProjectManagement.Infrastructure.Handlers.Sprints;

internal sealed class StartSprintHandler(ProjectManagementDbContext db)
    : ICommandHandler<StartSprintCommand, SprintDto>
{
    public async Task<Result<SprintDto>> Handle(StartSprintCommand cmd, CancellationToken ct)
    {
        var entity = await db.Sprints.FindAsync([cmd.Id], ct);
        if (entity is null)
            return Result.Failure<SprintDto>(Error.NotFoundById(nameof(Sprint), cmd.Id));

        var alreadyActive = await db.Sprints
            .AnyAsync(x => x.ProjectId == entity.ProjectId && x.Status == "active" && x.Id != entity.Id, ct);
        if (alreadyActive)
            return Result.Failure<SprintDto>(Error.Custom(
                "Sprint.AlreadyActive", "Another sprint in this project is already active. Complete it before starting a new one."));

        entity.Start();
        await db.SaveChangesAsync(ct);

        var issueCount = await db.Issues.CountAsync(x => x.SprintId == entity.Id, ct);
        return Result.Success(CreateSprintHandler.ToDto(entity, issueCount));
    }
}
