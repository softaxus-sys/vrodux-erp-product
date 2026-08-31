using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.RealEstate.Application.Units.Commands;
using Softaxis.RealEstate.Application.Units.Dtos;
using Softaxis.RealEstate.Domain.Entities;
using Softaxis.RealEstate.Infrastructure.Persistence;

namespace Softaxis.RealEstate.Infrastructure.Handlers.Units;

/// <summary>
/// Keeps the parent property's counts honest after units are added or removed.
///
/// `Property.TotalUnits` was a number typed in on the property form, independent of how many units
/// actually exist — so a property could claim 120 units while holding 3, and the occupancy
/// percentage derived from it was meaningless. Both are now recomputed from the real rows.
/// </summary>
internal static class PropertyCounts
{
    public static async Task RefreshAsync(RealEstateDbContext db, Guid propertyId, CancellationToken ct)
    {
        var property = await db.Properties.FirstOrDefaultAsync(p => p.Id == propertyId && !p.IsDeleted, ct);
        if (property is null) return;

        var units = await db.PropertyUnits.AsNoTracking()
            .Where(u => u.PropertyId == propertyId && !u.IsDeleted)
            .Select(u => u.Status)
            .ToListAsync(ct);

        property.Update(property.Name, property.PropertyType, property.Address, property.City,
            property.Emirate, property.TotalArea, units.Count, property.MarketValue,
            property.Developer, property.Description);

        // Must come second: UpdateOccupancy derives the status by comparing against TotalUnits,
        // so setting the count afterwards would leave the status computed from the old total.
        property.UpdateOccupancy(units.Count(s => s == "rented"));
    }
}

internal sealed class CreateUnitHandler(RealEstateDbContext db)
    : ICommandHandler<CreateUnitCommand, UnitDto>
{
    public async Task<Result<UnitDto>> Handle(CreateUnitCommand cmd, CancellationToken ct)
    {
        var property = await db.Properties.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == cmd.PropertyId && !p.IsDeleted, ct);
        if (property is null)
            return Result.Failure<UnitDto>(Error.NotFoundById("Property", cmd.PropertyId));

        var number = cmd.UnitNumber.Trim();

        // Unit numbers are how a lease, a tenant and a rent reminder all refer to the unit. Two
        // rows called "101" in the same building makes every one of those ambiguous.
        var duplicate = await db.PropertyUnits.AsNoTracking()
            .AnyAsync(u => !u.IsDeleted && u.PropertyId == cmd.PropertyId && u.UnitNumber == number, ct);
        if (duplicate)
            return Result.Failure<UnitDto>(Error.Custom("Unit.Duplicate",
                $"{property.Name} already has a unit {number}."));

        var unit = new PropertyUnit(cmd.PropertyId, number, cmd.UnitType.Trim(),
            cmd.Area, cmd.Floor, cmd.RentPerYear, cmd.SalePrice);

        unit.SetDetails(cmd.Furnishing, cmd.View, cmd.Bedrooms, cmd.Bathrooms,
            cmd.Parking, cmd.ServiceCharge, cmd.Notes);

        db.PropertyUnits.Add(unit);
        await db.SaveChangesAsync(ct);

        await PropertyCounts.RefreshAsync(db, cmd.PropertyId, ct);
        await db.SaveChangesAsync(ct);

        return Result.Success(UnitMappings.ToDto(unit));
    }
}

internal sealed class UpdateUnitHandler(RealEstateDbContext db) : ICommandHandler<UpdateUnitCommand>
{
    public async Task<Result> Handle(UpdateUnitCommand cmd, CancellationToken ct)
    {
        var unit = await db.PropertyUnits.FirstOrDefaultAsync(u => u.Id == cmd.Id && !u.IsDeleted, ct);
        if (unit is null) return Result.Failure(Error.NotFoundById("Unit", cmd.Id));

        var number = cmd.UnitNumber.Trim();
        var duplicate = await db.PropertyUnits.AsNoTracking()
            .AnyAsync(u => !u.IsDeleted && u.PropertyId == unit.PropertyId
                        && u.UnitNumber == number && u.Id != cmd.Id, ct);
        if (duplicate)
            return Result.Failure(Error.Custom("Unit.Duplicate",
                $"Another unit in this property is already numbered {number}."));

        unit.Update(number, cmd.UnitType.Trim(), cmd.Area, cmd.Floor, cmd.RentPerYear, cmd.SalePrice);
        unit.SetDetails(cmd.Furnishing, cmd.View, cmd.Bedrooms, cmd.Bathrooms,
            cmd.Parking, cmd.ServiceCharge, cmd.Notes);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class DeleteUnitHandler(RealEstateDbContext db) : ICommandHandler<DeleteUnitCommand>
{
    public async Task<Result> Handle(DeleteUnitCommand cmd, CancellationToken ct)
    {
        var unit = await db.PropertyUnits.FirstOrDefaultAsync(u => u.Id == cmd.Id && !u.IsDeleted, ct);
        if (unit is null) return Result.Failure(Error.NotFoundById("Unit", cmd.Id));

        // A let unit has a lease, a rent schedule and reminders hanging off it. Deleting it would
        // orphan all three and leave a tenant being chased for a unit that no longer exists.
        var hasActiveLease = await db.LeaseContracts.AsNoTracking()
            .AnyAsync(c => !c.IsDeleted && c.UnitId == cmd.Id && c.Status == "active", ct);
        if (hasActiveLease)
            return Result.Failure(Error.Custom("Unit.Conflict",
                "This unit has an active lease. End the lease before deleting the unit."));

        unit.Delete();
        await db.SaveChangesAsync(ct);

        await PropertyCounts.RefreshAsync(db, unit.PropertyId, ct);
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
