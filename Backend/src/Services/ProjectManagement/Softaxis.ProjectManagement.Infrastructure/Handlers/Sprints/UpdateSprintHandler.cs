using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.ProjectManagement.Application.Sprints.Commands;
using Softaxis.ProjectManagement.Application.Sprints.Dtos;
using Softaxis.ProjectManagement.Domain.Entities;
using Softaxis.ProjectManagement.Infrastructure.Persistence;

namespace Softaxis.ProjectManagement.Infrastructure.Handlers.Sprints;

internal sealed class UpdateSprintHandler(ProjectManagementDbContext db)
    : ICommandHandler<UpdateSprintCommand, SprintDto>
{
    public async Task<Result<SprintDto>> Handle(UpdateSprintCommand cmd, CancellationToken ct)
    {
        var entity = await db.Sprints.FindAsync([cmd.Id], ct);
        if (entity is null)
            return Result.Failure<SprintDto>(Error.NotFoundById(nameof(Sprint), cmd.Id));

        entity.UpdateDetails(cmd.Name, cmd.Goal, cmd.StartDate, cmd.EndDate);
        await db.SaveChangesAsync(ct);

        var issueCount = await db.Issues.CountAsync(x => x.SprintId == entity.Id, ct);
        return Result.Success(CreateSprintHandler.ToDto(entity, issueCount));
    }
}
