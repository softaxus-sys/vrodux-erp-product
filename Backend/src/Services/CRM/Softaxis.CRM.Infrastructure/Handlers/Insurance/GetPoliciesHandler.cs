using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Insurance.Dtos;
using Softaxis.CRM.Application.Insurance.Queries;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Insurance;

internal sealed class GetPoliciesHandler(CrmDbContext db) : IQueryHandler<GetPoliciesQuery, IReadOnlyList<PolicyDto>>
{
    public async Task<Result<IReadOnlyList<PolicyDto>>> Handle(GetPoliciesQuery query, CancellationToken ct)
    {
        var items = await db.Policies.AsNoTracking().OrderByDescending(x => x.CreatedAt).ToListAsync(ct);
        return Result.Success<IReadOnlyList<PolicyDto>>(items.Select(InsuranceMappings.ToDto).ToList());
    }
}
