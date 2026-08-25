using Microsoft.EntityFrameworkCore;
using Softaxis.HR.Domain.Entities;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Payroll;

/// <summary>
/// Employee number + IBAN per employee on a run. Held on the employee record rather than the
/// slip, and required by the WPS SIF export — every handler returning a run detail loads it.
/// </summary>
internal static class PayrollBankLookup
{
    public static async Task<IReadOnlyDictionary<Guid, (string? Number, string? Iban)>> ForRunAsync(
        HrDbContext db, PayrollRun run, CancellationToken ct)
    {
        var ids = run.Slips.Select(s => s.EmployeeId).Distinct().ToList();

        return await db.Employees
            .AsNoTracking()
            .Where(e => ids.Contains(e.Id))
            .Select(e => new { e.Id, e.EmployeeNumber, e.Iban })
            .ToDictionaryAsync(e => e.Id, e => ((string?)e.EmployeeNumber, e.Iban), ct);
    }
}
