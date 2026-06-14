using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.ProjectManagement.Application.Projects.Commands;
using Softaxis.ProjectManagement.Application.Projects.Dtos;
using Softaxis.ProjectManagement.Domain.Entities;
using Softaxis.ProjectManagement.Infrastructure.Persistence;

namespace Softaxis.ProjectManagement.Infrastructure.Handlers.Projects;

internal sealed class UpdateProjectHandler(ProjectManagementDbContext db)
    : ICommandHandler<UpdateProjectCommand, ProjectDto>
{
    public async Task<Result<ProjectDto>> Handle(UpdateProjectCommand cmd, CancellationToken ct)
    {
        var entity = await db.Projects.FindAsync([cmd.Id], ct);
        if (entity is null)
            return Result.Failure<ProjectDto>(Error.NotFoundById(nameof(Project), cmd.Id));

        entity.Rename(cmd.Name);
        entity.UpdateDescription(cmd.Description);
        entity.SetLead(cmd.LeadName);

        await db.SaveChangesAsync(ct);

        return Result.Success(CreateProjectHandler.ToDto(entity));
    }
}
