using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.RealEstate.Application.Abstractions;
using Softaxis.RealEstate.Application.Listings.Commands;
using Softaxis.RealEstate.Application.Listings.Dtos;
using Softaxis.RealEstate.Domain.Entities;
using Softaxis.RealEstate.Infrastructure.Handlers.Units;
using Softaxis.RealEstate.Infrastructure.Persistence;
using Softaxis.RealEstate.Infrastructure.Services;

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

internal sealed class CreateListingHandler(RealEstateDbContext db, ICurrentUser user)
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

        // Defaults to whoever is creating the listing — they just supplied the owner data, so they
        // are the natural first agent. An explicit AgentUserId hands it straight to someone else.
        unit.AssignAgent(cmd.AgentUserId ?? user.Id);
        unit.SetConfidentialRestriction(cmd.RestrictConfidentialDetails);

        if (!string.IsNullOrWhiteSpace(cmd.Status)) unit.SetOccupancy(cmd.Status.Trim());

        db.PropertyUnits.Add(unit);
        await db.SaveChangesAsync(ct);

        // Saved first: the refresh counts the unit rows back out of the database, so an uncommitted
        // unit would leave the building recorded as empty.
        await PropertyCounts.RefreshAsync(db, property.Id, ct);
        await db.SaveChangesAsync(ct);

        var galleries = await ListingMappings.LoadGalleriesAsync(db, [property.Id], ct);
        var dto = ListingMappings.ToDto(unit, property, galleries.GetValueOrDefault(property.Id, default));

        // Unmasked regardless of the final agent: the caller just typed this data in themselves, so
        // showing it back to them masked would be confusing, not confidential — they already know it.
        return Result.Success(dto);
    }

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}

internal sealed class UpdateListingHandler(RealEstateDbContext db, ICurrentUser user)
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

        // Managing the confidential fields — unit number, owner details, who the agent is, and
        // whether the restriction is even switched on — is a narrower authority than merely
        // VIEWING them (see ListingConfidentiality.CanManage): an unrestricted listing is visible
        // to every staff member, but that must not also let any of them edit the owner's phone
        // number or quietly re-lock the listing. Decided against the CURRENT agent, before anything
        // below changes it.
        var canManageConfidential = ListingConfidentiality.CanManage(user, unit.AgentUserId);

        string number;
        if (canManageConfidential)
        {
            number = cmd.UnitNumber.Trim();
            var duplicate = await db.PropertyUnits.AsNoTracking()
                .AnyAsync(u => !u.IsDeleted && u.PropertyId == unit.PropertyId
                            && u.UnitNumber == number && u.Id != cmd.Id, ct);
            if (duplicate)
                return Result.Failure<ListingDto>(Error.Custom("Unit.Duplicate",
                    $"Another unit in this building is already numbered {number}."));
        }
        else
        {
            // Confidential fields are not this caller's to change. The form never showed them a
            // real value to begin with, so whatever it sent is discarded rather than trusted —
            // the existing value is kept exactly as it was.
            number = unit.UnitNumber;
        }

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

        // Same "not this caller's to manage" rule for the owner fields — everything else in
        // SetListing (purpose, price label, marketing flags, the free-text agent name) is not
        // confidential and is written from the form as normal either way.
        var ownerName     = canManageConfidential ? cmd.OwnerName     : unit.OwnerName;
        var ownerPhone    = canManageConfidential ? cmd.OwnerPhone    : unit.OwnerPhone;
        var ownerPhoneAlt = canManageConfidential ? cmd.OwnerPhoneAlt : unit.OwnerPhoneAlt;

        unit.SetListing(cmd.Purpose, cmd.ListedOn, cmd.BedsLabel, cmd.PriceLabel, cmd.AreaLabel,
            cmd.HasMedia, cmd.IsListed, cmd.ListedBy, cmd.AgentName,
            ownerName, ownerPhone, ownerPhoneAlt);

        // Reassigning the agent, or flipping the restriction switch itself, is a management action.
        // Both are skipped entirely (not even attempted) for a caller who could not already manage
        // this listing's confidential fields.
        if (canManageConfidential)
        {
            unit.AssignAgent(cmd.AgentUserId);
            unit.SetConfidentialRestriction(cmd.RestrictConfidentialDetails);
        }

        // Occupancy drives the building's own status, so the counts are refreshed below rather
        // than left describing the unit's previous state.
        if (!string.IsNullOrWhiteSpace(cmd.Status)) unit.SetOccupancy(cmd.Status.Trim());

        await db.SaveChangesAsync(ct);

        await PropertyCounts.RefreshAsync(db, property.Id, ct);
        await db.SaveChangesAsync(ct);

        var galleries = await ListingMappings.LoadGalleriesAsync(db, [property.Id], ct);
        var dto = ListingMappings.ToDto(unit, property, galleries.GetValueOrDefault(property.Id, default));

        // Reflects the listing's ACTUAL, post-edit state — an unrestricted listing is open to VIEW
        // for this caller too, even though they may have had no authority to MANAGE it a moment ago
        // (and still don't, if this edit didn't reassign them as the agent).
        var canViewFinal   = ListingConfidentiality.CanView(user, unit.AgentUserId, unit.RestrictConfidentialDetails);
        var canManageFinal = ListingConfidentiality.CanManage(user, unit.AgentUserId);

        return Result.Success(ListingMappings.ApplyConfidentiality(dto, canViewFinal, canManageFinal));
    }

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}
