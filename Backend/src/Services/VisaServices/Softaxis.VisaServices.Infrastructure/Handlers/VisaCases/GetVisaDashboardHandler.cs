using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.VisaServices.Application.VisaCases.Dtos;
using Softaxis.VisaServices.Application.VisaCases.Queries;
using Softaxis.VisaServices.Infrastructure.Persistence;

namespace Softaxis.VisaServices.Infrastructure.Handlers.VisaCases;

internal sealed class GetVisaDashboardHandler(VisaDbContext db)
    : IQueryHandler<GetVisaDashboardQuery, VisaDashboardDto>
{
    private static readonly string[] ClosedStatuses = ["closed", "cancelled", "issued", "rejected"];

    public async Task<Result<VisaDashboardDto>> Handle(GetVisaDashboardQuery query, CancellationToken ct)
    {
        var today = DateTime.UtcNow.ToString("yyyy-MM-dd");
        var weekAhead = DateTime.UtcNow.AddDays(7).ToString("yyyy-MM-dd");
        var in30 = DateTime.UtcNow.AddDays(30).ToString("yyyy-MM-dd");
        var in90 = DateTime.UtcNow.AddDays(90).ToString("yyyy-MM-dd");

        var cases = await db.VisaCases.AsNoTracking()
            .Where(c => !c.IsDeleted)
            .Select(c => new { c.Status, c.VisaTypeName, c.ServiceFee, c.GovtFee, c.AssignedTo, c.SlaDueDate, c.VisaExpiryDate })
            .ToListAsync(ct);

        var open = cases.Where(c => !ClosedStatuses.Contains(c.Status)).ToList();

        var byStatus = cases.GroupBy(c => c.Status)
            .Select(g => new VisaCountItem(g.Key, g.Count()))
            .OrderByDescending(x => x.Count).ToList();

        var byType = cases.GroupBy(c => c.VisaTypeName)
            .Select(g => new VisaCountItem(g.Key, g.Count()))
            .OrderByDescending(x => x.Count).ToList();

        var revenueByType = cases.GroupBy(c => c.VisaTypeName)
            .Select(g => new VisaRevenueItem(g.Key, g.Sum(x => x.ServiceFee), g.Sum(x => x.GovtFee)))
            .OrderByDescending(x => x.ServiceFees + x.GovtFees).ToList();

        var workload = open.Where(c => !string.IsNullOrWhiteSpace(c.AssignedTo))
            .GroupBy(c => c.AssignedTo)
            .Select(g => new VisaWorkloadItem(g.Key, g.Count()))
            .OrderByDescending(x => x.OpenCount).ToList();

        // Expiry counts — passports (from applicants) and case documents with an expiry date.
        var expiringPassports = await db.Applicants.AsNoTracking()
            .CountAsync(a => a.PassportExpiry != null && a.PassportExpiry.CompareTo(today) >= 0
                          && a.PassportExpiry.CompareTo(in90) <= 0, ct);
        var expiringDocs = await db.CaseDocuments.AsNoTracking()
            .CountAsync(d => d.ExpiryDate != null && d.ExpiryDate.CompareTo(today) >= 0
                          && d.ExpiryDate.CompareTo(in30) <= 0, ct);

        return Result.Success(new VisaDashboardDto(
            TotalCases:           cases.Count,
            OpenCases:            open.Count,
            OverdueCases:         open.Count(c => c.SlaDueDate != null && c.SlaDueDate.CompareTo(today) < 0),
            DueThisWeek:          open.Count(c => c.SlaDueDate != null && c.SlaDueDate.CompareTo(today) >= 0
                                                   && c.SlaDueDate.CompareTo(weekAhead) <= 0),
            OpenServiceFees:      open.Sum(c => c.ServiceFee),
            OpenGovtFees:         open.Sum(c => c.GovtFee),
            ExpiringDocuments30:  expiringDocs,
            ExpiringPassports90:  expiringPassports,
            ExpiringVisas90:      cases.Count(c => c.VisaExpiryDate != null && c.VisaExpiryDate.CompareTo(today) >= 0
                                                    && c.VisaExpiryDate.CompareTo(in90) <= 0),
            ByStatus:             byStatus,
            ByType:               byType,
            RevenueByType:        revenueByType,
            Workload:             workload));
    }
}
