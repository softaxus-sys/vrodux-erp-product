using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Insurance.Dtos;
using Softaxis.CRM.Application.Insurance.Queries;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Insurance;

internal sealed class GetClaimsHandler(CrmDbContext db) : IQueryHandler<GetClaimsQuery, IReadOnlyList<InsuranceClaimDto>>
{
    public async Task<Result<IReadOnlyList<InsuranceClaimDto>>> Handle(GetClaimsQuery query, CancellationToken ct)
    {
        var items = await db.InsuranceClaims.AsNoTracking().OrderByDescending(x => x.CreatedAt).ToListAsync(ct);
        return Result.Success<IReadOnlyList<InsuranceClaimDto>>(items.Select(InsuranceMappings.ToDto).ToList());
    }
}
