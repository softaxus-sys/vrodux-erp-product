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
        // ApplyTenantId replaces the configuration filter on IsDeleted, so it is applied by hand.
        // Without it these totals counted rows the lists no longer show.
        var pol = await db.Policies.AsNoTracking().Where(x => !x.IsDeleted).Select(x => new { x.Status, x.Premium, x.SumInsured }).ToListAsync(ct);
        var ren = await db.PolicyRenewals.AsNoTracking().Where(x => !x.IsDeleted).CountAsync(x => x.Status == "due", ct);
        var clm = await db.InsuranceClaims.AsNoTracking().Where(x => !x.IsDeleted).Select(x => new { x.Status, x.ClaimAmount, x.ApprovedAmount }).ToListAsync(ct);

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
