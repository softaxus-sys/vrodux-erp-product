using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Recruitment.Dtos;
using Softaxis.HR.Application.Recruitment.Queries;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Recruitment;

internal sealed class GetRecruitmentSummaryHandler(HrDbContext db)
    : IQueryHandler<GetRecruitmentSummaryQuery, RecruitmentSummaryDto>
{
    public async Task<Result<RecruitmentSummaryDto>> Handle(GetRecruitmentSummaryQuery query, CancellationToken ct)
    {
        var openPositions   = await db.JobPostings.AsNoTracking().CountAsync(x => x.Status == "open", ct);
        var totalApplicants = await db.Applicants.AsNoTracking().CountAsync(ct);
        var inInterview     = await db.Applicants.AsNoTracking().CountAsync(x => x.Stage == "interview", ct);
        var offers          = await db.Applicants.AsNoTracking().CountAsync(x => x.Stage == "offer", ct);

        var thisMonth = DateTime.UtcNow.ToString("yyyy-MM");
        var hiredThisMonth = await db.Applicants.AsNoTracking()
            .CountAsync(x => x.Stage == "hired" && x.AppliedDate.StartsWith(thisMonth), ct);

        return Result.Success(new RecruitmentSummaryDto(openPositions, totalApplicants, inInterview, offers, hiredThisMonth, 0));
    }
}
