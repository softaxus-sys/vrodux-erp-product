using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.VisaServices.Application.VisaCases.Dtos;
using Softaxis.VisaServices.Application.VisaCases.Queries;
using Softaxis.VisaServices.Infrastructure.Persistence;

namespace Softaxis.VisaServices.Infrastructure.Handlers.VisaCases;

internal sealed class GetVisaCasesSummaryHandler(VisaDbContext db)
    : IQueryHandler<GetVisaCasesSummaryQuery, VisaCasesSummaryDto>
{
    private static readonly string[] ClosedStatuses = ["closed", "cancelled", "issued", "rejected"];

    public async Task<Result<VisaCasesSummaryDto>> Handle(GetVisaCasesSummaryQuery query, CancellationToken ct)
    {
        var monthStart = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1);

        var all = await db.VisaCases.AsNoTracking()
            .Where(c => !c.IsDeleted)
            .Select(c => new { c.Status, c.ServiceFee, c.GovtFee, c.UpdatedAt })
            .ToListAsync(ct);

        var open = all.Where(c => !ClosedStatuses.Contains(c.Status)).ToList();

        return Result.Success(new VisaCasesSummaryDto(
            Total:             all.Count,
            Open:              open.Count,
            DocsPending:       all.Count(c => c.Status == "docs_pending" || c.Status == "rfi_required"),
            Submitted:         all.Count(c => c.Status == "submitted" || c.Status == "in_review"),
            ApprovedThisMonth: all.Count(c => (c.Status == "approved" || c.Status == "issued")
                                              && c.UpdatedAt >= monthStart),
            Rejected:          all.Count(c => c.Status == "rejected"),
            OpenServiceFees:   open.Sum(c => c.ServiceFee),
            OpenGovtFees:      open.Sum(c => c.GovtFee)));
    }
}
