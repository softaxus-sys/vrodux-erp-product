using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.ProjectManagement.Application.Labels.Dtos;
using Softaxis.ProjectManagement.Application.Labels.Queries;
using Softaxis.ProjectManagement.Infrastructure.Persistence;

namespace Softaxis.ProjectManagement.Infrastructure.Handlers.Labels;

internal sealed class GetLabelsHandler(ProjectManagementDbContext db)
    : IQueryHandler<GetLabelsQuery, IReadOnlyList<LabelDto>>
{
    public async Task<Result<IReadOnlyList<LabelDto>>> Handle(GetLabelsQuery query, CancellationToken ct)
    {
        var items = await db.Labels
            .AsNoTracking()
            .Where(x => x.ProjectId == query.ProjectId)
            .OrderBy(x => x.Name)
            .Select(x => new LabelDto(x.Id, x.ProjectId, x.Name, x.Color))
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<LabelDto>>(items);
    }
}
