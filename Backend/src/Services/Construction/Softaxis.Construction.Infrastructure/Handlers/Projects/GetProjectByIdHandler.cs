using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Construction.Application.Projects.Dtos;
using Softaxis.Construction.Application.Projects.Queries;
using Softaxis.Construction.Infrastructure.Persistence;

namespace Softaxis.Construction.Infrastructure.Handlers.Projects;

internal sealed class GetProjectByIdHandler(ConstructionDbContext db)
    : IQueryHandler<GetProjectByIdQuery, ProjectDto>
{
    public async Task<Result<ProjectDto>> Handle(GetProjectByIdQuery query, CancellationToken ct)
    {
        var p = await db.Projects.AsNoTracking().Include(x => x.Phases)
            .FirstOrDefaultAsync(x => x.Id == query.Id, ct);

        return p is null
            ? Result.Failure<ProjectDto>(Error.NotFoundById("Project", query.Id))
            : Result.Success(ProjectMappings.ToDto(p));
    }
}
