using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Construction.Application.Projects.Commands;
using Softaxis.Construction.Application.Projects.Dtos;
using Softaxis.Construction.Domain.Entities;
using Softaxis.Construction.Infrastructure.Persistence;

namespace Softaxis.Construction.Infrastructure.Handlers.Projects;

internal sealed class CreateProjectHandler(ConstructionDbContext db)
    : ICommandHandler<CreateProjectCommand, ProjectDto>
{
    public async Task<Result<ProjectDto>> Handle(CreateProjectCommand cmd, CancellationToken ct)
    {
        var p = new Project(cmd.Name, cmd.Client, cmd.Location, cmd.ProjectType, cmd.StartDate, cmd.EndDate,
            cmd.ContractValue, cmd.ProjectManager, cmd.SiteEngineer, cmd.Notes);

        db.Projects.Add(p);
        await db.SaveChangesAsync(ct);

        return Result.Success(ProjectMappings.ToDto(p));
    }
}
