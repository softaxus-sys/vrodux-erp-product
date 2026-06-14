using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Insurance.Dtos;
using Softaxis.CRM.Application.Insurance.Queries;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Insurance;

internal sealed class GetInsuranceSummaryHandler(CrmDbContext db) : IQueryHandler<GetInsuranceSummaryQuery, InsuranceSummaryDto>
{
    public async Task<Result<InsuranceSummaryDto>> Handle(GetInsuranceSummaryQuery query, CancellationToken ct)
    {
        var pol = await db.Policies.AsNoTracking().Select(x => new { x.Status, x.Premium, x.SumInsured }).ToListAsync(ct);
        var ren = await db.PolicyRenewals.AsNoTracking().CountAsync(x => x.Status == "due", ct);
        var clm = await db.InsuranceClaims.AsNoTracking().Select(x => new { x.Status, x.ClaimAmount, x.ApprovedAmount }).ToListAsync(ct);

        return Result.Success(new InsuranceSummaryDto(
            pol.Count,
            pol.Count(x => x.Status is "issued" or "renewed"),
            pol.Count(x => x.Status == "proposal"),
            pol.Where(x => x.Status is "issued" or "renewed").Sum(x => x.Premium),
            ren,
            clm.Count(x => x.Status is "filed" or "under_review"),
            clm.Where(x => x.Status == "paid").Sum(x => x.ApprovedAmount)));
    }
}
