using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.RealEstate.Application.Properties.Commands;
using Softaxis.RealEstate.Application.Units.Commands;
using Softaxis.RealEstate.Domain.Entities;
using Softaxis.RealEstate.Infrastructure.Persistence;

namespace Softaxis.RealEstate.Infrastructure.Handlers.Units;

/// <summary>
/// Imports a spreadsheet of units.
///
/// <para>Rows name their building rather than carrying an id, because a sheet from a developer or an
/// agent has building names in it. A row whose building cannot be found is reported by name — that is
/// a typo the person can fix — rather than silently dropped or, worse, filed under a near-match.</para>
///
/// <para>Duplicate unit numbers within a building are skipped, not created: the unit number is how a
/// lease, a tenant and a rent reminder all refer to the unit, so two "101"s in one building makes
/// every one of those ambiguous. That is also what makes re-running a corrected file safe.</para>
/// </summary>
internal sealed class ImportUnitsHandler(RealEstateDbContext db)
    : ICommandHandler<ImportUnitsCommand, ImportResult>
{
    private const int MaxReportedProblems = 100;

    public async Task<Result<ImportResult>> Handle(ImportUnitsCommand cmd, CancellationToken ct)
    {
        var properties = await db.Properties.AsNoTracking()
            .Where(p => !p.IsDeleted)
            .Select(p => new { p.Id, p.Name, p.PropertyNumber })
            .ToListAsync(ct);

        // Name first, then property number: a sheet usually carries the name, but an export from our
        // own system carries the number, and both should just work.
        var byName   = new Dictionary<string, Guid>(StringComparer.OrdinalIgnoreCase);
        var byNumber = new Dictionary<string, Guid>(StringComparer.OrdinalIgnoreCase);
        foreach (var p in properties)
        {
            byName[p.Name] = p.Id;
            if (!string.IsNullOrWhiteSpace(p.PropertyNumber)) byNumber[p.PropertyNumber] = p.Id;
        }

        if (cmd.PropertyId is { } fixedId && properties.All(p => p.Id != fixedId))
            return Result.Failure<ImportResult>(Error.NotFoundById("Property", fixedId));

        // Existing unit numbers per property, so a duplicate is caught without a query per row.
        var takenList = await db.PropertyUnits.AsNoTracking()
            .Where(u => !u.IsDeleted)
            .Select(u => new { u.PropertyId, u.UnitNumber })
            .ToListAsync(ct);

        var taken = new HashSet<(Guid, string)>(
            takenList.Select(u => (u.PropertyId, u.UnitNumber.ToUpperInvariant())));

        int created = 0, skipped = 0, failed = 0;
        var problems = new List<ImportRowProblem>();
        var touched  = new HashSet<Guid>();

        void Problem(int row, string message)
        {
            if (problems.Count < MaxReportedProblems) problems.Add(new ImportRowProblem(row, message));
        }

        for (var i = 0; i < cmd.Rows.Count; i++)
        {
            var row    = cmd.Rows[i];
            var number = row.UnitNumber?.Trim();

            if (string.IsNullOrWhiteSpace(number))
            {
                failed++;
                Problem(i, "Unit number is missing.");
                continue;
            }

            Guid propertyId;
            if (cmd.PropertyId is { } scoped)
            {
                propertyId = scoped;
            }
            else
            {
                var key = row.PropertyName?.Trim();
                if (string.IsNullOrWhiteSpace(key))
                {
                    failed++;
                    Problem(i, $"Unit {number} has no property — add a Property column, or import from inside a property.");
                    continue;
                }

                if (!byName.TryGetValue(key, out propertyId) && !byNumber.TryGetValue(key, out propertyId))
                {
                    failed++;
                    Problem(i, $"No property called \"{key}\" — check the spelling, or import that property first.");
                    continue;
                }
            }

            // Covers both what is already stored and repeats within this same file.
            if (!taken.Add((propertyId, number.ToUpperInvariant())))
            {
                skipped++;
                Problem(i, $"Unit {number} already exists in that property — skipped.");
                continue;
            }

            try
            {
                var unit = new PropertyUnit(
                    propertyId, number,
                    string.IsNullOrWhiteSpace(row.UnitType) ? "Apartment" : row.UnitType.Trim(),
                    ImportNumber.Decimal(row.Area), ImportNumber.Int(row.Floor),
                    ImportNumber.Decimal(row.RentPerYear), ImportNumber.Decimal(row.SalePrice));

                unit.SetDetails(row.Furnishing?.Trim(), row.View?.Trim(),
                    ImportNumber.NullableInt(row.Bedrooms), ImportNumber.NullableInt(row.Bathrooms),
                    ImportNumber.Int(row.Parking), ImportNumber.Decimal(row.ServiceCharge),
                    row.Notes?.Trim());

                db.PropertyUnits.Add(unit);
                touched.Add(propertyId);
                created++;
            }
            catch (Exception ex)
            {
                failed++;
                Problem(i, ex.Message);
            }
        }

        if (created > 0)
        {
            // Saved before refreshing the counts: PropertyCounts reads the unit rows back, so it has
            // to see them committed or every touched property would be recounted as unchanged.
            await db.SaveChangesAsync(ct);

            foreach (var propertyId in touched)
                await PropertyCounts.RefreshAsync(db, propertyId, ct);

            await db.SaveChangesAsync(ct);
        }

        return Result.Success(new ImportResult(created, skipped, failed, problems));
    }
}
