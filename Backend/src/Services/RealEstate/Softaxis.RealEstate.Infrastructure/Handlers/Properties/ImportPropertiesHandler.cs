using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.RealEstate.Application.Properties.Commands;
using Softaxis.RealEstate.Domain.Entities;
using Softaxis.RealEstate.Infrastructure.Persistence;
using Softaxis.RealEstate.Infrastructure.Handlers;

namespace Softaxis.RealEstate.Infrastructure.Handlers.Properties;

/// <summary>
/// Imports a spreadsheet of buildings.
///
/// <para>A bad row never aborts the batch — a portfolio handover of two hundred buildings should not
/// be lost to one blank name on row 137. Each problem is counted and reported with its row number so
/// the file can be corrected and re-run.</para>
///
/// <para>Re-running is safe: a building whose name already exists is <b>skipped, not duplicated</b>.
/// Property names are how leases, units and rent reminders are read by a human, so two "Marina
/// Heights" rows would make every one of those ambiguous. Skipping is also what makes a corrected
/// re-import work — only the rows that failed the first time are created.</para>
/// </summary>
internal sealed class ImportPropertiesHandler(RealEstateDbContext db)
    : ICommandHandler<ImportPropertiesCommand, ImportResult>
{
    /// <summary>Cap on the detail returned. The tallies always cover every row.</summary>
    private const int MaxReportedProblems = 100;

    public async Task<Result<ImportResult>> Handle(ImportPropertiesCommand cmd, CancellationToken ct)
    {
        // Loaded once rather than queried per row: an import is the one place where N round-trips
        // would actually be felt.
        var existing = await db.Properties.AsNoTracking()
            .Where(p => !p.IsDeleted)
            .Select(p => p.Name)
            .ToListAsync(ct);

        var seen = new HashSet<string>(existing, StringComparer.OrdinalIgnoreCase);

        int created = 0, skipped = 0, failed = 0;
        var problems = new List<ImportRowProblem>();

        void Problem(int row, string message)
        {
            if (problems.Count < MaxReportedProblems) problems.Add(new ImportRowProblem(row, message));
        }

        for (var i = 0; i < cmd.Rows.Count; i++)
        {
            var row  = cmd.Rows[i];
            var name = row.Name?.Trim();

            if (string.IsNullOrWhiteSpace(name))
            {
                failed++;
                Problem(i, "Property name is missing.");
                continue;
            }

            // Catches duplicates already in the database AND repeats within this same file, which is
            // common when a sheet lists one row per unit and the building name repeats down a column.
            if (!seen.Add(name))
            {
                skipped++;
                Problem(i, $"\"{name}\" already exists — skipped.");
                continue;
            }

            try
            {
                db.Properties.Add(new Property(
                    name,
                    Fallback(row.PropertyType, "Residential Tower"),
                    row.Address?.Trim() ?? string.Empty,
                    row.City?.Trim()    ?? string.Empty,
                    // Emirate is required by the create command, but a spreadsheet often omits it and
                    // it is editable afterwards, so an import does not fail the row over it.
                    Fallback(row.Emirate, "Dubai"),
                    ImportNumber.Decimal(row.TotalArea),
                    // Recomputed from the real unit rows whenever units are added, so a typed total
                    // here would only be overwritten. Starts honest at zero.
                    totalUnits: 0,
                    ImportNumber.Decimal(row.MarketValue),
                    row.Developer?.Trim(),
                    row.Description?.Trim()));

                created++;
            }
            catch (Exception ex)
            {
                failed++;
                Problem(i, ex.Message);
            }
        }

        if (created > 0) await db.SaveChangesAsync(ct);

        return Result.Success(new ImportResult(created, skipped, failed, problems));
    }

    private static string Fallback(string? value, string whenMissing) =>
        string.IsNullOrWhiteSpace(value) ? whenMissing : value.Trim();
}
