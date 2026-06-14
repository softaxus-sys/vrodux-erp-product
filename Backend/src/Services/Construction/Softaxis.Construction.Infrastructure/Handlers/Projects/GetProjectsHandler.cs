using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Construction.Application.Projects.Dtos;
using Softaxis.Construction.Application.Projects.Queries;
using Softaxis.Construction.Infrastructure.Persistence;

namespace Softaxis.Construction.Infrastructure.Handlers.Projects;

internal sealed class GetProjectsHandler(ConstructionDbContext db)
    : IQueryHandler<GetProjectsQuery, IReadOnlyList<ProjectDto>>
{
    public async Task<Result<IReadOnlyList<ProjectDto>>> Handle(GetProjectsQuery query, CancellationToken ct)
    {
        var items = await db.Projects.AsNoTracking().Include(x => x.Phases)
            .Where(x => !x.IsDeleted).OrderByDescending(x => x.CreatedAt).ToListAsync(ct);

        return Result.Success<IReadOnlyList<ProjectDto>>(items.Select(ProjectMappings.ToDto).ToList());
    }
}
