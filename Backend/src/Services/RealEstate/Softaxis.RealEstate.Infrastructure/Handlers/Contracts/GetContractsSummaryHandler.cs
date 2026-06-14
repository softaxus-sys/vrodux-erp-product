using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.RealEstate.Application.Contracts.Dtos;
using Softaxis.RealEstate.Application.Contracts.Queries;
using Softaxis.RealEstate.Infrastructure.Persistence;

namespace Softaxis.RealEstate.Infrastructure.Handlers.Contracts;

internal sealed class GetContractsSummaryHandler(RealEstateDbContext db)
    : IQueryHandler<GetContractsSummaryQuery, ContractsSummaryDto>
{
    public async Task<Result<ContractsSummaryDto>> Handle(GetContractsSummaryQuery query, CancellationToken ct)
    {
        var all = await db.LeaseContracts.AsNoTracking().Where(x => !x.IsDeleted)
            .Select(x => new { x.Status, x.AnnualRent, x.TotalPaid, x.EndDate }).ToListAsync(ct);

        var expiringSoon = DateTime.UtcNow.AddDays(60).ToString("yyyy-MM-dd");

        return Result.Success(new ContractsSummaryDto(
            all.Count,
            all.Count(x => x.Status == "active"),
            all.Count(x => x.Status == "expired"),
            all.Count(x => x.Status == "terminated"),
            all.Sum(x => x.AnnualRent),
            all.Sum(x => x.TotalPaid),
            all.Sum(x => x.AnnualRent - x.TotalPaid),
            all.Count(x => x.Status == "active" && string.Compare(x.EndDate, expiringSoon, StringComparison.Ordinal) <= 0)));
    }
}
