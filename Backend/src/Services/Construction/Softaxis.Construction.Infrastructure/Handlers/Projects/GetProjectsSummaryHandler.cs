using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Construction.Application.Projects.Dtos;
using Softaxis.Construction.Application.Projects.Queries;
using Softaxis.Construction.Infrastructure.Persistence;

namespace Softaxis.Construction.Infrastructure.Handlers.Projects;

internal sealed class GetProjectsSummaryHandler(ConstructionDbContext db)
    : IQueryHandler<GetProjectsSummaryQuery, ProjectsSummaryDto>
{
    public async Task<Result<ProjectsSummaryDto>> Handle(GetProjectsSummaryQuery query, CancellationToken ct)
    {
        var all = await db.Projects.AsNoTracking().Where(x => !x.IsDeleted)
            .Select(x => new { x.Status, x.ContractValue, x.BudgetSpent, x.CompletionPct }).ToListAsync(ct);

        var dto = new ProjectsSummaryDto(
            all.Count,
            all.Count(x => x.Status == "in_progress"),
            all.Count(x => x.Status == "completed"),
            all.Count(x => x.Status == "on_hold"),
            all.Count(x => x.Status == "planning"),
            all.Sum(x => x.ContractValue),
            all.Sum(x => x.BudgetSpent),
            all.Count > 0 ? all.Average(x => x.CompletionPct) : 0);

        return Result.Success(dto);
    }
}
