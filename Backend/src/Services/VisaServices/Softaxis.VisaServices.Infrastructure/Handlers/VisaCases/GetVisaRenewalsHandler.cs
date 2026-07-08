using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.VisaServices.Application.VisaCases.Dtos;
using Softaxis.VisaServices.Application.VisaCases.Queries;
using Softaxis.VisaServices.Infrastructure.Persistence;

namespace Softaxis.VisaServices.Infrastructure.Handlers.VisaCases;

internal sealed class GetVisaRenewalsHandler(VisaDbContext db)
    : IQueryHandler<GetVisaRenewalsQuery, IReadOnlyList<RenewalItemDto>>
{
    public async Task<Result<IReadOnlyList<RenewalItemDto>>> Handle(GetVisaRenewalsQuery query, CancellationToken ct)
    {
        var horizon = DateTime.UtcNow.AddDays(query.WithinDays).ToString("yyyy-MM-dd");

        // Case lookup for denorm fields (only non-closed cases are actionable for renewal).
        var cases = await db.VisaCases.AsNoTracking()
            .Where(c => !c.IsDeleted)
            .Select(c => new { c.Id, c.CaseNumber, c.VisaTypeName, c.Status, c.AssignedTo, c.VisaExpiryDate })
            .ToListAsync(ct);
        var caseById = cases.ToDictionary(c => c.Id);

        var items = new List<RenewalItemDto>();

        // Issued visas nearing their own expiry — the primary renewal driver.
        foreach (var c in cases.Where(c => c.VisaExpiryDate != null && c.VisaExpiryDate.CompareTo(horizon) <= 0))
            items.Add(new RenewalItemDto("visa", c.Id, c.CaseNumber, c.VisaTypeName,
                $"{c.VisaTypeName} — visa expiry", c.VisaExpiryDate, DaysLeft(c.VisaExpiryDate), c.Status, c.AssignedTo));

        // Passport expiries (within horizon, including already overdue).
        var passports = await db.Applicants.AsNoTracking()
            .Where(a => a.PassportExpiry != null && a.PassportExpiry.CompareTo(horizon) <= 0)
            .Select(a => new { a.VisaCaseId, a.FirstName, a.LastName, a.PassportExpiry })
            .ToListAsync(ct);
        foreach (var p in passports)
        {
            if (!caseById.TryGetValue(p.VisaCaseId, out var c)) continue;
            items.Add(new RenewalItemDto("passport", c.Id, c.CaseNumber, c.VisaTypeName,
                $"{p.FirstName} {p.LastName}".Trim() + " — passport", p.PassportExpiry,
                DaysLeft(p.PassportExpiry), c.Status, c.AssignedTo));
        }

        // Document expiries (medicals, insurance, etc. carry an expiry date).
        var docs = await db.CaseDocuments.AsNoTracking()
            .Where(d => d.ExpiryDate != null && d.ExpiryDate.CompareTo(horizon) <= 0)
            .Select(d => new { d.VisaCaseId, d.Name, d.ExpiryDate })
            .ToListAsync(ct);
        foreach (var d in docs)
        {
            if (!caseById.TryGetValue(d.VisaCaseId, out var c)) continue;
            items.Add(new RenewalItemDto("document", c.Id, c.CaseNumber, c.VisaTypeName,
                d.Name, d.ExpiryDate, DaysLeft(d.ExpiryDate), c.Status, c.AssignedTo));
        }

        return Result.Success<IReadOnlyList<RenewalItemDto>>(
            items.OrderBy(x => x.DaysLeft).ToList());   // most urgent (incl. overdue negatives) first
    }

    private static int DaysLeft(string? date) =>
        DateTime.TryParseExact(date, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var d)
            ? (int)(d.Date - DateTime.UtcNow.Date).TotalDays
            : int.MaxValue;
}
