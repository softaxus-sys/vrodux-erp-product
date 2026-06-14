using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Construction.Application.Contractors.Dtos;
using Softaxis.Construction.Application.Contractors.Queries;
using Softaxis.Construction.Infrastructure.Persistence;

namespace Softaxis.Construction.Infrastructure.Handlers.Contractors;

internal sealed class GetContractorsHandler(ConstructionDbContext db)
    : IQueryHandler<GetContractorsQuery, IReadOnlyList<ContractorDto>>
{
    public async Task<Result<IReadOnlyList<ContractorDto>>> Handle(GetContractorsQuery query, CancellationToken ct)
    {
        var items = await db.Contractors.AsNoTracking().Where(x => !x.IsDeleted)
            .OrderBy(x => x.CompanyName).ToListAsync(ct);

        return Result.Success<IReadOnlyList<ContractorDto>>(items.Select(ContractorMappings.ToDto).ToList());
    }
}
