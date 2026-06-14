using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Construction.Application.Contractors.Dtos;
using Softaxis.Construction.Application.Contractors.Queries;
using Softaxis.Construction.Infrastructure.Persistence;

namespace Softaxis.Construction.Infrastructure.Handlers.Contractors;

internal sealed class GetContractorsSummaryHandler(ConstructionDbContext db)
    : IQueryHandler<GetContractorsSummaryQuery, ContractorsSummaryDto>
{
    public async Task<Result<ContractorsSummaryDto>> Handle(GetContractorsSummaryQuery query, CancellationToken ct)
    {
        var all = await db.Contractors.AsNoTracking().Where(x => !x.IsDeleted)
            .Select(x => new { x.Trade, x.ActiveProjects, x.CompletedProjects, x.TotalContractValue, x.Rating }).ToListAsync(ct);

        var dto = new ContractorsSummaryDto(
            all.Count,
            all.Count(x => x.Trade == "civil"),
            all.Count(x => x.Trade == "structural"),
            all.Count(x => x.Trade == "mep"),
            all.Sum(x => x.ActiveProjects),
            all.Sum(x => x.TotalContractValue),
            all.Count > 0 ? all.Average(x => (double)x.Rating) : 0);

        return Result.Success(dto);
    }
}
