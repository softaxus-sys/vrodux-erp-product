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
                    description: null,
                    // The sheet's own Residential / Commercial column. Null falls back to
                    // residential inside the entity rather than being guessed from the type.
                    category: RentalStockParser.ParseCategory(row.Category));

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
                var purpose = RentalStockParser.ParsePurpose(row.Purpose);
                var isSale  = purpose == "sale";

                // Which money column the price belongs in. A sale sheet's "7M" is an asking price,
                // and the old code put every one of them into annual rent — so a building worth
                // seven million read as a seven-million-a-year tenancy in the rent roll.
                var (amount, cheques) = RentalStockParser.ParseRent(row.Price, annualise: !isSale);

                var unit = new PropertyUnit(
                    propertyId, number!,
                    RentalStockParser.NormaliseType(row.PropertyType),
                    RentalStockParser.ParseArea(row.Area) ?? 0,
                    floor: 0,
                    rentPerYear: isSale ? 0 : amount ?? 0,
                    salePrice:   isSale ? amount ?? 0 : 0);

                unit.SetDetails(
                    RentalStockParser.ParseFurnishing(row.Furnishing),
                    row.View?.Trim(),
                    RentalStockParser.ParseBeds(row.Beds),
                    bathrooms: null,
                    parking: 0,
                    serviceCharge: 0,
                    // The cheque count still has no column of its own, so it is written here where
                    // an agent can at least read it. The owner and agent now have real fields.
                    notes: BuildNotes(row, cheques, generated));

                // The marketing half of the row. Each of these was previously either glued into
                // Notes as a sentence or dropped on the floor.
                unit.SetListing(
                    purpose,
                    RentalStockParser.ParseListedOn(row.ListedOn),
                    // The layout, price and area are kept exactly as written alongside the numbers
                    // parsed out of them: "700k(rented till 29 feb 2026 in 55k)" carries a
                    // condition that no single figure can.
                    bedsLabel:  row.Beds?.Trim(),
                    priceLabel: row.Price?.Trim(),
                    areaLabel:  row.Area?.Trim(),
                    hasMedia:   RentalStockParser.ParseYesNo(row.Pictures),
                    isListed:   RentalStockParser.ParseYesNo(row.Listing),
                    listedBy:   row.ListedBy?.Trim(),
                    agentName:  row.Agent?.Trim(),
                    ownerName:  row.OwnerName?.Trim(),
                    ownerPhone: row.OwnerPhone?.Trim(),
                    ownerPhoneAlt: row.OwnerPhoneAlt?.Trim());

                // Occupancy where it is stated, and failing that from the price cell — these sheets
                // write it there far more often than in a column of its own: "1.15M(vacant)",
                // "700k(rented till 29 feb 2026 in 55k)".
                if ((RentalStockParser.ParseStatus(row.Occupancy)
                     ?? RentalStockParser.ParseStatus(row.Price)) is { } status)
                    unit.SetOccupancy(status);

                db.PropertyUnits.Add(unit);
                touched.Add(propertyId);
                unitsCreated++;

                // Flagged rather than failed: the listing is worth keeping even when its price cell
                // is written in a way this cannot read ("market price", "500 per night").
                if (amount is null && !string.IsNullOrWhiteSpace(row.Price))
                    Problem(i, $"{building} {number}: could not read a figure from \"{row.Price?.Trim()}\" — " +
                               "imported as 0, but the cell itself is kept on the listing.");
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
        // The owner, their contact and the agent used to be written into this sentence because
        // they had no columns. They have their own fields now, so repeating them here would show
        // the same facts twice on every listing.
        var parts = new List<string>();

        if (cheques is { } c)                           parts.Add($"Payable over {c} cheque{(c == 1 ? "" : "s")}");
        if (generatedNumber)                            parts.Add("Unit number not in the source file — please correct.");

        return parts.Count == 0 ? null : string.Join(" · ", parts);
    }
}
