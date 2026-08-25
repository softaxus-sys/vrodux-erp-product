using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Payroll.Dtos;
using Softaxis.HR.Application.Payroll.Queries;
using Softaxis.HR.Domain.Entities;
using Softaxis.HR.Infrastructure.Handlers.WorkSchedules;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Payroll;

internal static class WpsConfigLookup
{
    /// <summary>
    /// Seeded empty on first read rather than at startup, so the row is stamped with the caller's
    /// tenant. <see cref="WpsConfiguration.IsComplete"/> is what tells the UI it still needs
    /// filling in — an empty row is honest, invented identifiers would not be.
    /// </summary>
    public static async Task<WpsConfiguration> GetOrCreateAsync(HrDbContext db, CancellationToken ct)
    {
        var existing = await db.WpsConfigurations.FirstOrDefaultAsync(x => !x.IsDeleted, ct);
        if (existing is not null) return existing;

        var seeded = new WpsConfiguration(string.Empty, string.Empty);
        db.WpsConfigurations.Add(seeded);
        await db.SaveChangesAsync(ct);
        return seeded;
    }

    public static WpsConfigurationDto ToDto(WpsConfiguration c) =>
        new(c.EmployerUniqueId, c.EmployerBankRoutingCode, c.FileSequence, c.IsComplete);
}

internal sealed class GetWpsConfigurationHandler(HrDbContext db)
    : IQueryHandler<GetWpsConfigurationQuery, WpsConfigurationDto>
{
    public async Task<Result<WpsConfigurationDto>> Handle(GetWpsConfigurationQuery q, CancellationToken ct)
        => Result.Success(WpsConfigLookup.ToDto(await WpsConfigLookup.GetOrCreateAsync(db, ct)));
}

internal sealed class UpdateWpsConfigurationHandler(HrDbContext db)
    : ICommandHandler<UpdateWpsConfigurationCommand, WpsConfigurationDto>
{
    public async Task<Result<WpsConfigurationDto>> Handle(UpdateWpsConfigurationCommand cmd, CancellationToken ct)
    {
        var config = await WpsConfigLookup.GetOrCreateAsync(db, ct);
        config.Update(cmd.EmployerUniqueId, cmd.EmployerBankRoutingCode);
        await db.SaveChangesAsync(ct);
        return Result.Success(WpsConfigLookup.ToDto(config));
    }
}

internal sealed class GetWpsSifHandler(HrDbContext db)
    : IQueryHandler<GetWpsSifQuery, WpsSifFileDto>
{
    public async Task<Result<WpsSifFileDto>> Handle(GetWpsSifQuery query, CancellationToken ct)
    {
        var run = await db.PayrollRuns
            .Include(r => r.Slips)
            .FirstOrDefaultAsync(r => r.Id == query.RunId && !r.IsDeleted, ct);
        if (run is null)
            return Result.Failure<WpsSifFileDto>(Error.NotFoundById("PayrollRun", query.RunId));

        var config = await WpsConfigLookup.GetOrCreateAsync(db, ct);
        if (!config.IsComplete)
            return Result.Failure<WpsSifFileDto>(Error.Custom("Wps.NotConfigured",
                "Set the MOHRE establishment number and the agent bank routing code before generating a salary file."));

        // Every identifier in the file comes off the employee record — none can be derived from
        // the payslip, which is why the export needs this join rather than the slip alone.
        var employeeIds = run.Slips.Select(s => s.EmployeeId).Distinct().ToList();
        var employees = await db.Employees
            .AsNoTracking()
            .Where(e => employeeIds.Contains(e.Id))
            .Select(e => new { e.Id, e.LabourCardNumber, e.BankRoutingCode, e.Iban })
            .ToDictionaryAsync(e => e.Id, ct);

        var included = new List<WpsSalaryLine>();
        var issues   = new List<WpsIssueDto>();

        foreach (var slip in run.Slips)
        {
            employees.TryGetValue(slip.EmployeeId, out var e);

            var line = new WpsSalaryLine(
                slip.EmployeeName,
                e?.LabourCardNumber,
                e?.BankRoutingCode,
                e?.Iban,
                // Basic pay is the fixed component; allowances vary month to month, which is the
                // split WPS asks for. Deductions reduce the variable side and never the fixed —
                // a negative fixed component is rejected outright.
                slip.BasicSalary,
                Math.Max(0, slip.Allowances - slip.Deductions));

            var problems = WpsSifBuilder.Validate(line).ToList();
            if (problems.Count > 0)
            {
                issues.AddRange(problems.Select(p => new WpsIssueDto(p.EmployeeName, p.Problem)));
                continue;
            }

            included.Add(line);
        }

        // Nobody eligible is reported as an empty file WITH the reasons, not as a failure. Failing
        // would throw away the per-employee detail at exactly the moment it is most needed — the
        // first export, before anyone has entered a labour card number.
        if (included.Count == 0)
            return Result.Success(new WpsSifFileDto(
                string.Empty, string.Empty, 0, 0, run.Slips.Count, issues));

        // The sequence is allocated only once a file is actually produced, so an export that
        // yields nothing does not burn a number and leave a gap the agent asks about.
        var sequence = config.NextSequence();

        var schedule = await WorkScheduleLookup.FindAsync(db, ct);
        var built = WpsSifBuilder.Build(
            config, run.Period, included, WorkScheduleRules.LocalNow(schedule), sequence);

        await db.SaveChangesAsync(ct);

        return Result.Success(new WpsSifFileDto(
            built.FileName, built.Content, built.RecordCount, built.TotalSalary,
            run.Slips.Count - included.Count, issues));
    }
}
