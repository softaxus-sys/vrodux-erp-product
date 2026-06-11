using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.RealEstate.Application.Contracts.Dtos;
using Softaxis.RealEstate.Application.Contracts.Queries;
using Softaxis.RealEstate.Infrastructure.Persistence;

namespace Softaxis.RealEstate.Infrastructure.Handlers.Contracts;

internal sealed class GetContractsHandler(RealEstateDbContext db)
    : IQueryHandler<GetContractsQuery, IReadOnlyList<ContractDto>>
{
    public async Task<Result<IReadOnlyList<ContractDto>>> Handle(GetContractsQuery query, CancellationToken ct)
    {
        var items = await db.LeaseContracts.AsNoTracking().Where(x => !x.IsDeleted)
            .OrderByDescending(x => x.CreatedAt).ToListAsync(ct);

        return Result.Success<IReadOnlyList<ContractDto>>(items.Select(ContractMappings.ToDto).ToList());
    }
}
