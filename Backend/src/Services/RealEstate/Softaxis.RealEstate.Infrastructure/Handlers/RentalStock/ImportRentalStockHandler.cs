using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.RealEstate.Application.Properties.Commands;
using Softaxis.RealEstate.Application.Units.Commands;
using Softaxis.RealEstate.Domain.Entities;
using Softaxis.RealEstate.Infrastructure.Handlers.Units;
using Softaxis.RealEstate.Infrastructure.Persistence;

namespace Softaxis.RealEstate.Infrastructure.Handlers.RentalStock;

/// <summary>
/// Imports an agency rental-stock sheet, creating the buildings as it goes.
///
/// <para>These sheets list what is being marketed, not a property register: the same building appears
/// once per available apartment. Buildings are therefore created on first sight and reused for every
/// later row, so 318 listings across 198 towers produce 198 properties, not 318.</para>
/// </summary>
internal sealed class ImportRentalStockHandler(RealEstateDbContext db)
    : ICommandHandler<ImportRentalStockCommand, RentalStockImportResult>
{
    private const int MaxReportedProblems = 100;

    public async Task<Result<RentalStockImportResult>> Handle(
        ImportRentalStockCommand cmd, CancellationToken ct)
    {
        // Loaded once. An import is the one place where a query per row would actually be felt.
        var properties = await db.Properties.AsNoTracking()
            .Where(p => !p.IsDeleted)
            .Select(p => new { p.Id, p.Name })
            .ToListAsync(ct);

        var byName = new Dictionary<string, Guid>(StringComparer.OrdinalIgnoreCase);
        foreach (var p in properties) byName[p.Name] = p.Id;

        var takenUnits = new HashSet<(Guid, string)>(
            (await db.PropertyUnits.AsNoTracking()
                .Where(u => !u.IsDeleted)
                .Select(u => new { u.PropertyId, u.UnitNumber })
                .ToListAsync(ct))
            .Select(u => (u.PropertyId, u.UnitNumber.ToUpperInvariant())));

        // Buildings created in this run but not yet saved, so later rows reuse them rather than
        // creating the same tower a second time.
        var pending = new Dictionary<string, Property>(StringComparer.OrdinalIgnoreCase);

        int propertiesCreated = 0, unitsCreated = 0, skipped = 0, failed = 0;
        var problems = new List<ImportRowProblem>();
        var touched  = new HashSet<Guid>();

        void Problem(int row, string message)
        {
            if (problems.Count < MaxReportedProblems) problems.Add(new ImportRowProblem(row, message));
        }

        for (var i = 0; i < cmd.Rows.Count; i++)
        {
            var row      = cmd.Rows[i];
            var building = row.Building?.Trim();

            if (string.IsNullOrWhiteSpace(building))
            {
                failed++;
                Problem(i, "No building named — the unit cannot be placed.");
                continue;
            }

            // ── the building ──
            Guid propertyId;
            Property? newProperty = null;

            if (byName.TryGetValue(building, out var existingId))
            {
                propertyId = existingId;
            }
            else if (pending.TryGetValue(building, out var already))
            {
                newProperty = already;
                propertyId  = already.Id;
            }
            else
            {
                newProperty = new Property(
                    building,
                    RentalStockParser.NormaliseType(row.PropertyType),
                    address: string.Empty,
                    city: row.Location?.Trim() ?? string.Empty,
                    // These sheets carry an area, not an emirate. Left to the workspace default
                    // rather than guessed from the community name.
                    emirate: "Dubai",
                    totalArea: 0,
                    totalUnits: 0,          // recomputed from the real rows below
                    marketValue: 0,
                    developer: null,
                    description: null);

                db.Properties.Add(newProperty);
                pending[building] = newProperty;
                propertyId = newProperty.Id;
                propertiesCreated++;
            }

            // ── the unit ──
            // These sheets almost never carry a unit number: it is the building and the layout that
            // are being marketed. A sequential placeholder is generated so the listing is not lost,
            // and it is obviously a placeholder rather than something that looks like a real door
            // number someone might put on a lease.
            var number = row.UnitNumber?.Trim();
            var generated = string.IsNullOrWhiteSpace(number);

            if (generated)
            {
                var n = 1;
                while (takenUnits.Contains((propertyId, $"LISTING-{n}"))) n++;
                number = $"LISTING-{n}";
            }

            if (!takenUnits.Add((propertyId, number!.ToUpperInvariant())))
            {
                skipped++;
                Problem(i, $"{building} already has a unit {number} — skipped.");
                continue;
            }

            try
            {
                var (rent, cheques) = RentalStockParser.ParseRent(row.Price);

                var unit = new PropertyUnit(
                    propertyId, number!,
                    RentalStockParser.NormaliseType(row.PropertyType),
                    RentalStockParser.ParseArea(row.Area) ?? 0,
                    floor: 0,
                    rentPerYear: rent ?? 0,
                    salePrice: 0);

                unit.SetDetails(
                    RentalStockParser.ParseFurnishing(row.Furnishing),
                    row.View?.Trim(),
                    RentalStockParser.ParseBeds(row.Beds),
                    bathrooms: null,
                    parking: 0,
                    serviceCharge: 0,
                    // The owner and the cheque count have no column of their own. Losing them would
                    // be worse than recording them here, where an agent can still read them.
                    notes: BuildNotes(row, cheques, generated));

                if (RentalStockParser.ParseStatus(row.Occupancy) is { } status)
                    unit.SetOccupancy(status);

                db.PropertyUnits.Add(unit);
                touched.Add(propertyId);
                unitsCreated++;

                // Flagged rather than failed: the listing is worth keeping even when its price cell
                // is written in a way this cannot read ("market price", "500 per night").
                if (rent is null && !string.IsNullOrWhiteSpace(row.Price))
                    Problem(i, $"{building} {number}: could not read the rent \"{row.Price?.Trim()}\" — imported as 0.");
            }
            catch (Exception ex)
            {
                failed++;
                Problem(i, ex.Message);
            }
        }

        if (unitsCreated > 0 || propertiesCreated > 0)
        {
            // Saved first: PropertyCounts reads the unit rows back, so they have to be committed or
            // every building would be recounted as empty.
            await db.SaveChangesAsync(ct);

            foreach (var propertyId in touched)
                await PropertyCounts.RefreshAsync(db, propertyId, ct);

            await db.SaveChangesAsync(ct);
        }

        return Result.Success(new RentalStockImportResult(
            propertiesCreated, unitsCreated, skipped, failed, problems));
    }

    private static string? BuildNotes(RentalStockRow row, int? cheques, bool generatedNumber)
    {
        var parts = new List<string>();

        if (!string.IsNullOrWhiteSpace(row.OwnerName))  parts.Add($"Owner: {row.OwnerName!.Trim()}");
        if (!string.IsNullOrWhiteSpace(row.OwnerPhone)) parts.Add($"Owner contact: {row.OwnerPhone!.Trim()}");
        if (!string.IsNullOrWhiteSpace(row.Agent))      parts.Add($"Agent: {row.Agent!.Trim()}");
        if (cheques is { } c)                           parts.Add($"Rent over {c} cheque{(c == 1 ? "" : "s")}");
        if (generatedNumber)                            parts.Add("Unit number not in the source file — please correct.");

        return parts.Count == 0 ? null : string.Join(" · ", parts);
    }
}
