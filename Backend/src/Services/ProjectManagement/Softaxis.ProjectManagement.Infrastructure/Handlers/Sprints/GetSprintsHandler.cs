using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.ProjectManagement.Application.Sprints.Dtos;
using Softaxis.ProjectManagement.Application.Sprints.Queries;
using Softaxis.ProjectManagement.Infrastructure.Persistence;

namespace Softaxis.ProjectManagement.Infrastructure.Handlers.Sprints;

internal sealed class GetSprintsHandler(ProjectManagementDbContext db)
    : IQueryHandler<GetSprintsQuery, IReadOnlyList<SprintDto>>
{
    public async Task<Result<IReadOnlyList<SprintDto>>> Handle(GetSprintsQuery query, CancellationToken ct)
    {
        var items = await db.Sprints
            .AsNoTracking()
            .Where(x => x.ProjectId == query.ProjectId)
            .OrderBy(x => x.SortOrder)
            .Select(x => new SprintDto(
                x.Id, x.ProjectId, x.Name, x.Goal, x.StartDate, x.EndDate, x.Status, x.SortOrder,
                x.Issues.Count(i => i.SprintId == x.Id)))
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<SprintDto>>(items);
    }
}
