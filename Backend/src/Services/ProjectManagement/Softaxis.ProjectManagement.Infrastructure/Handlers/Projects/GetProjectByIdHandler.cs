using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.ProjectManagement.Application.Projects.Dtos;
using Softaxis.ProjectManagement.Application.Projects.Queries;
using Softaxis.ProjectManagement.Domain.Entities;
using Softaxis.ProjectManagement.Infrastructure.Persistence;
using Softaxis.ProjectManagement.Infrastructure.Services;

namespace Softaxis.ProjectManagement.Infrastructure.Handlers.Projects;

internal sealed class GetProjectByIdHandler(ProjectManagementDbContext db, IProjectAccessGuard accessGuard)
    : IQueryHandler<GetProjectByIdQuery, ProjectDto>
{
    public async Task<Result<ProjectDto>> Handle(GetProjectByIdQuery query, CancellationToken ct)
    {
        var entity = await db.Projects.AsNoTracking().FirstOrDefaultAsync(x => x.Id == query.Id, ct);
        if (entity is null || !await accessGuard.CanAccessAsync(query.Id, ct))
            return Result.Failure<ProjectDto>(Error.NotFoundById(nameof(Project), query.Id));

        return Result.Success(CreateProjectHandler.ToDto(entity));
    }
}
