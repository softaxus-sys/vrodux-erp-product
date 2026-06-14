using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.B2B.Dtos;
using Softaxis.CRM.Application.B2B.Queries;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.B2B;

internal sealed class GetContractsHandler(CrmDbContext db) : IQueryHandler<GetContractsQuery, IReadOnlyList<ServiceContractDto>>
{
    public async Task<Result<IReadOnlyList<ServiceContractDto>>> Handle(GetContractsQuery query, CancellationToken ct)
    {
        var items = await db.ServiceContracts.AsNoTracking().OrderByDescending(x => x.CreatedAt).ToListAsync(ct);
        return Result.Success<IReadOnlyList<ServiceContractDto>>(items.Select(B2BMappings.ToDto).ToList());
    }
}
