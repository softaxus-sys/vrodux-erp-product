using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.VisaServices.Application.VisaCases.Dtos;
using Softaxis.VisaServices.Application.VisaCases.Queries;
using Softaxis.VisaServices.Infrastructure.Persistence;

namespace Softaxis.VisaServices.Infrastructure.Handlers.VisaCases;

internal sealed class GetVisaCasesHandler(VisaDbContext db)
    : IQueryHandler<GetVisaCasesQuery, IReadOnlyList<VisaCaseSummaryDto>>
{
    public async Task<Result<IReadOnlyList<VisaCaseSummaryDto>>> Handle(GetVisaCasesQuery query, CancellationToken ct)
    {
        var cases = await db.VisaCases.AsNoTracking()
            .Where(c => !c.IsDeleted)
            .Where(c => query.Status == null || c.Status == query.Status)
            .Where(c => query.CustomerId == null || c.CustomerId == query.CustomerId)
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync(ct);

        if (cases.Count == 0)
            return Result.Success<IReadOnlyList<VisaCaseSummaryDto>>([]);

        var caseIds = cases.Select(c => c.Id).ToList();

        var applicants = await db.Applicants.AsNoTracking()
            .Where(a => caseIds.Contains(a.VisaCaseId))
            .Select(a => new { a.VisaCaseId, a.FirstName, a.LastName, a.Relationship })
            .ToListAsync(ct);

        var docCounts = await db.CaseDocuments.AsNoTracking()
            .Where(d => caseIds.Contains(d.VisaCaseId))
            .GroupBy(d => d.VisaCaseId)
            .Select(g => new { CaseId = g.Key, Total = g.Count(), Pending = g.Count(d => d.Status != "verified") })
            .ToListAsync(ct);
        var docsByCase = docCounts.ToDictionary(x => x.CaseId);

        var applicantsByCase = applicants.GroupBy(a => a.VisaCaseId).ToDictionary(g => g.Key, g => g.ToList());

        var items = cases.Select(c =>
        {
            applicantsByCase.TryGetValue(c.Id, out var apps);
            var primary = apps?.FirstOrDefault(a => a.Relationship == "primary") ?? apps?.FirstOrDefault();
            docsByCase.TryGetValue(c.Id, out var docs);
            return new VisaCaseSummaryDto(
                c.Id, c.CaseNumber, c.VisaTypeId, c.VisaTypeName, c.Channel, c.Emirate,
                c.CustomerId, c.CustomerName, c.Status, c.Priority, c.AssignedTo,
                c.ServiceFee, c.GovtFee, c.GovtReference, c.SlaDueDate,
                primary is null ? "" : $"{primary.FirstName} {primary.LastName}".Trim(),
                apps?.Count ?? 0, docs?.Pending ?? 0, docs?.Total ?? 0,
                c.InvoiceId, c.InvoiceNumber,
                c.CreatedAt, c.UpdatedAt);
        }).ToList();

        return Result.Success<IReadOnlyList<VisaCaseSummaryDto>>(items);
    }
}
