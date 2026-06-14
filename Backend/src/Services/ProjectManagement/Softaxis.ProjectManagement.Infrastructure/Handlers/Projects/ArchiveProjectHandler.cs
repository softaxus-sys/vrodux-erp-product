using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.ProjectManagement.Application.Projects.Commands;
using Softaxis.ProjectManagement.Application.Projects.Dtos;
using Softaxis.ProjectManagement.Domain.Entities;
using Softaxis.ProjectManagement.Infrastructure.Persistence;

namespace Softaxis.ProjectManagement.Infrastructure.Handlers.Projects;

internal sealed class ArchiveProjectHandler(ProjectManagementDbContext db)
    : ICommandHandler<ArchiveProjectCommand, ProjectDto>
{
    public async Task<Result<ProjectDto>> Handle(ArchiveProjectCommand cmd, CancellationToken ct)
    {
        var entity = await db.Projects.FindAsync([cmd.Id], ct);
        if (entity is null)
            return Result.Failure<ProjectDto>(Error.NotFoundById(nameof(Project), cmd.Id));

        entity.Archive();
        await db.SaveChangesAsync(ct);

        return Result.Success(CreateProjectHandler.ToDto(entity));
    }
}

internal sealed class ActivateProjectHandler(ProjectManagementDbContext db)
    : ICommandHandler<ActivateProjectCommand, ProjectDto>
{
    public async Task<Result<ProjectDto>> Handle(ActivateProjectCommand cmd, CancellationToken ct)
    {
        var entity = await db.Projects.FindAsync([cmd.Id], ct);
        if (entity is null)
            return Result.Failure<ProjectDto>(Error.NotFoundById(nameof(Project), cmd.Id));

        entity.Activate();
        await db.SaveChangesAsync(ct);

        return Result.Success(CreateProjectHandler.ToDto(entity));
    }
}
