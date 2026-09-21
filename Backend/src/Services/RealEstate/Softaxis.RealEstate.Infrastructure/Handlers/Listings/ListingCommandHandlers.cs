using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.RealEstate.Application.Listings.Commands;
using Softaxis.RealEstate.Application.Listings.Dtos;
using Softaxis.RealEstate.Domain.Entities;
using Softaxis.RealEstate.Infrastructure.Handlers.Units;
using Softaxis.RealEstate.Infrastructure.Persistence;

namespace Softaxis.RealEstate.Infrastructure.Handlers.Listings;

internal static class ListingNumbering
{
    /// <summary>
    /// A door number for a listing that arrived without one.
    /// </summary>
    /// <remarks>
    /// Deliberately obvious as a placeholder. Something that looked like a real door number would
    /// eventually be copied onto a lease. Matches what the rental-stock importer generates, so the
    /// two paths do not produce two different conventions in the same building.
    /// </remarks>
    public static async Task<string> NextPlaceholderAsync(
        RealEstateDbContext db, Guid propertyId, CancellationToken ct)
    {
        var taken = await db.PropertyUnits.AsNoTracking()
            .Where(u => !u.IsDeleted && u.PropertyId == propertyId)
            .Select(u => u.UnitNumber)
            .ToListAsync(ct);

        var used = new HashSet<string>(taken, StringComparer.OrdinalIgnoreCase);

        var n = 1;
        while (used.Contains($"LISTING-{n}")) n++;
        return $"LISTING-{n}";
    }
}

internal sealed class CreateListingHandler(RealEstateDbContext db)
    : ICommandHandler<CreateListingCommand, ListingDto>
{
    public async Task<Result<ListingDto>> Handle(CreateListingCommand cmd, CancellationToken ct)
    {
        var propertyType = Clean(cmd.PropertyType) ?? "Apartment";

        // ── the building ──
        Property property;

        if (cmd.PropertyId.HasValue)
        {
            var existing = await db.Properties
                .FirstOrDefaultAsync(p => p.Id == cmd.PropertyId.Value && !p.IsDeleted, ct);
            if (existing is null)
                return Result.Failure<ListingDto>(Error.NotFoundById("Property", cmd.PropertyId.Value));

            // Left exactly as it is. Adding a sixth apartment to a tower is not the moment to
            // rewrite that tower's address or valuation from whatever happens to be on this form.
            property = existing;
        }
        else
        {
            var name = Clean(cmd.PropertyName)!;

            // Reused rather than duplicated when the name is already on file. Two "Cayan Tower"
            // rows would split its photographs, its occupancy and its website listing in half,
            // and nothing downstream would report either copy correctly.
            var match = await db.Properties
                .FirstOrDefaultAsync(p => !p.IsDeleted && p.Name == name, ct);

            if (match is not null)
            {
                property = match;
            }
            else
            {
                property = new Property(
                    name, propertyType,
                    Clean(cmd.Address) ?? string.Empty,
                    Clean(cmd.City) ?? string.Empty,
                    Clean(cmd.Emirate) ?? "Dubai",
                    totalArea: 0,
                    totalUnits: 0,          // recomputed from the real rows below
                    cmd.PropertyMarketValue,
                    Clean(cmd.Developer),
                    Clean(cmd.PropertyDescription),
                    cmd.Category);

                db.Properties.Add(property);
            }
        }

        // ── the unit ──
        var number = Clean(cmd.UnitNumber)
                     ?? await ListingNumbering.NextPlaceholderAsync(db, property.Id, ct);

        // Unit numbers are how a lease, a tenant and a rent reminder all refer to the unit. Two
        // rows called "101" in the same building makes every one of those ambiguous.
        var duplicate = await db.PropertyUnits.AsNoTracking()
            .AnyAsync(u => !u.IsDeleted && u.PropertyId == property.Id && u.UnitNumber == number, ct);
        if (duplicate)
            return Result.Failure<ListingDto>(Error.Custom("Unit.Duplicate",
                $"{property.Name} already has a unit {number}."));

        var unit = new PropertyUnit(property.Id, number, Clean(cmd.UnitType) ?? propertyType,
            cmd.Area, cmd.Floor, cmd.RentPerYear, cmd.SalePrice);

        unit.SetDetails(cmd.Furnishing, cmd.View, cmd.Bedrooms, cmd.Bathrooms,
            cmd.Parking, cmd.ServiceCharge, cmd.Notes);

        unit.SetListing(cmd.Purpose, cmd.ListedOn, cmd.BedsLabel, cmd.PriceLabel, cmd.AreaLabel,
            cmd.HasMedia, cmd.IsListed, cmd.ListedBy, cmd.AgentName,
            cmd.OwnerName, cmd.OwnerPhone, cmd.OwnerPhoneAlt);

        if (!string.IsNullOrWhiteSpace(cmd.Status)) unit.SetOccupancy(cmd.Status.Trim());

        db.PropertyUnits.Add(unit);
        await db.SaveChangesAsync(ct);

        // Saved first: the refresh counts the unit rows back out of the database, so an uncommitted
        // unit would leave the building recorded as empty.
        await PropertyCounts.RefreshAsync(db, property.Id, ct);
        await db.SaveChangesAsync(ct);

        var galleries = await ListingMappings.LoadGalleriesAsync(db, [property.Id], ct);
        return Result.Success(ListingMappings.ToDto(
            unit, property, galleries.GetValueOrDefault(property.Id, default)));
    }

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}

internal sealed class UpdateListingHandler(RealEstateDbContext db)
    : ICommandHandler<UpdateListingCommand, ListingDto>
{
    public async Task<Result<ListingDto>> Handle(UpdateListingCommand cmd, CancellationToken ct)
    {
        var unit = await db.PropertyUnits.FirstOrDefaultAsync(u => u.Id == cmd.Id && !u.IsDeleted, ct);
        if (unit is null) return Result.Failure<ListingDto>(Error.NotFoundById("Listing", cmd.Id));

        var property = await db.Properties
            .FirstOrDefaultAsync(p => p.Id == unit.PropertyId && !p.IsDeleted, ct);
        if (property is null)
            return Result.Failure<ListingDto>(Error.NotFoundById("Property", unit.PropertyId));

        var number = cmd.UnitNumber.Trim();
        var duplicate = await db.PropertyUnits.AsNoTracking()
            .AnyAsync(u => !u.IsDeleted && u.PropertyId == unit.PropertyId
                        && u.UnitNumber == number && u.Id != cmd.Id, ct);
        if (duplicate)
            return Result.Failure<ListingDto>(Error.Custom("Unit.Duplicate",
                $"Another unit in this building is already numbered {number}."));

        // ── the building ──
        // Only when the form sent a name. Property.Update is a full replace, so writing it from a
        // payload that does not carry these fields would blank the address and the valuation — the
        // exact failure Module 53e fixed on the property form.
        if (!string.IsNullOrWhiteSpace(cmd.PropertyName))
        {
            property.Update(
                cmd.PropertyName.Trim(),
                Clean(cmd.PropertyType) ?? property.PropertyType,
                Clean(cmd.Address) ?? property.Address,
                Clean(cmd.City) ?? property.City,
                Clean(cmd.Emirate) ?? property.Emirate,
                property.TotalArea,
                property.TotalUnits,
                cmd.PropertyMarketValue ?? property.MarketValue,
                Clean(cmd.Developer) ?? property.Developer,
                Clean(cmd.PropertyDescription) ?? property.Description,
                cmd.Category);
        }

        // ── the unit ──
        unit.Update(number, Clean(cmd.UnitType) ?? unit.UnitType,
            cmd.Area, cmd.Floor, cmd.RentPerYear, cmd.SalePrice);

        unit.SetDetails(cmd.Furnishing, cmd.View, cmd.Bedrooms, cmd.Bathrooms,
            cmd.Parking, cmd.ServiceCharge, cmd.Notes);

        unit.SetListing(cmd.Purpose, cmd.ListedOn, cmd.BedsLabel, cmd.PriceLabel, cmd.AreaLabel,
            cmd.HasMedia, cmd.IsListed, cmd.ListedBy, cmd.AgentName,
            cmd.OwnerName, cmd.OwnerPhone, cmd.OwnerPhoneAlt);

        // Occupancy drives the building's own status, so the counts are refreshed below rather
        // than left describing the unit's previous state.
        if (!string.IsNullOrWhiteSpace(cmd.Status)) unit.SetOccupancy(cmd.Status.Trim());

        await db.SaveChangesAsync(ct);

        await PropertyCounts.RefreshAsync(db, property.Id, ct);
        await db.SaveChangesAsync(ct);

        var galleries = await ListingMappings.LoadGalleriesAsync(db, [property.Id], ct);
        return Result.Success(ListingMappings.ToDto(
            unit, property, galleries.GetValueOrDefault(property.Id, default)));
    }

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}
