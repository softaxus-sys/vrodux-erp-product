using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Insurance.Dtos;
using Softaxis.CRM.Application.Insurance.Queries;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Insurance;

internal sealed class GetRenewalsHandler(CrmDbContext db) : IQueryHandler<GetRenewalsQuery, IReadOnlyList<PolicyRenewalDto>>
{
    public async Task<Result<IReadOnlyList<PolicyRenewalDto>>> Handle(GetRenewalsQuery query, CancellationToken ct)
    {
        var items = await db.PolicyRenewals.AsNoTracking().OrderByDescending(x => x.CreatedAt).ToListAsync(ct);
        return Result.Success<IReadOnlyList<PolicyRenewalDto>>(items.Select(InsuranceMappings.ToDto).ToList());
    }
}
