using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Hospitality.Application.Rooms.Commands;
using Softaxis.Hospitality.Application.Rooms.Dtos;
using Softaxis.Hospitality.Application.Rooms.Queries;
using Softaxis.Hospitality.Domain.Entities;
using Softaxis.Hospitality.Infrastructure.Handlers.Pms;
using Softaxis.Hospitality.Infrastructure.Persistence;

namespace Softaxis.Hospitality.Infrastructure.Handlers.Rooms;

internal static class SetupMappings
{
    public static RoomTypeDto ToDto(RoomType t, int roomCount) => new(
        t.Id, t.Code, t.Name, t.Description, t.Amenities, t.BaseRate, t.MaxAdults, t.MaxChildren, t.IsActive, roomCount);

    public static RoomBlockDto ToDto(RoomBlock b) => new(b.Id, b.RoomId, b.RoomNumber, b.FromDate, b.ToDate, b.Reason);

    public static HotelSettingsDto ToDto(HotelSettings s) => new(
        s.PropertyName, s.WeekendDays, s.CheckInTime, s.CheckOutTime, s.TaxPercent, s.TaxLabel,
        s.ServiceChargePercent, s.NightlyFee, s.NightlyFeeLabel);

    public static async Task<RatePlanDto> ToDtoAsync(HospitalityDbContext db, RatePlan p, CancellationToken ct)
    {
        var seasons = await db.SeasonalRates.AsNoTracking().Where(s => s.RatePlanId == p.Id)
            .OrderBy(s => s.FromDate).ToListAsync(ct);
        var typeNames = await db.RoomTypes.AsNoTracking().ToDictionaryAsync(t => t.Id, t => t.Name, ct);
        return ToDto(p, seasons, typeNames);
    }

    public static RatePlanDto ToDto(RatePlan p, IEnumerable<SeasonalRate> seasons, IReadOnlyDictionary<Guid, string> typeNames) => new(
        p.Id, p.Code, p.Name, p.MealPlan, p.IsRefundable, p.Description, p.IsDefault, p.IsActive,
        seasons.Select(s => new SeasonalRateDto(s.Id, s.RatePlanId, s.RoomTypeId,
            typeNames.TryGetValue(s.RoomTypeId, out var n) ? n : "—",
            s.Label, s.FromDate, s.ToDate, s.WeekdayRate, s.WeekendRate, s.MinNights)).ToList());

    public static Error Conflict(string code, string message) => Error.Custom($"{code}.Conflict", message);
}

// ── Room types ───────────────────────────────────────────────────────────────

internal sealed class GetRoomTypesHandler(HospitalityDbContext db) : IQueryHandler<GetRoomTypesQuery, IReadOnlyList<RoomTypeDto>>
{
    public async Task<Result<IReadOnlyList<RoomTypeDto>>> Handle(GetRoomTypesQuery q, CancellationToken ct)
    {
        await PmsBootstrap.EnsureRoomTypesAsync(db, ct);
        var types = await db.RoomTypes.AsNoTracking().Where(t => !t.IsDeleted && (q.IncludeInactive || t.IsActive))
            .OrderBy(t => t.BaseRate).ThenBy(t => t.Name).ToListAsync(ct);
        var counts = await db.Rooms.AsNoTracking().Where(r => !r.IsDeleted && r.RoomTypeId != null)
            .GroupBy(r => r.RoomTypeId!.Value).Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, ct);
        return Result.Success<IReadOnlyList<RoomTypeDto>>(types
            .Select(t => SetupMappings.ToDto(t, counts.GetValueOrDefault(t.Id))).ToList());
    }
}

internal sealed class UpsertRoomTypeHandler(HospitalityDbContext db) : ICommandHandler<UpsertRoomTypeCommand, RoomTypeDto>
{
    public async Task<Result<RoomTypeDto>> Handle(UpsertRoomTypeCommand cmd, CancellationToken ct)
    {
        var code = cmd.Code.Trim().ToUpperInvariant();
        if (await db.RoomTypes.AnyAsync(t => !t.IsDeleted && t.Code == code && t.Id != cmd.Id, ct))
            return Result.Failure<RoomTypeDto>(Error.Custom("RoomType.Duplicate", $"A room type with code {code} already exists."));

        RoomType type;
        if (cmd.Id is null)
        {
            type = new RoomType(code, cmd.Name, cmd.BaseRate, cmd.MaxAdults, cmd.MaxChildren, cmd.Description, cmd.Amenities);
            db.RoomTypes.Add(type);
        }
        else
        {
            type = (await db.RoomTypes.FirstOrDefaultAsync(t => t.Id == cmd.Id && !t.IsDeleted, ct))!;
            if (type is null) return Result.Failure<RoomTypeDto>(Error.NotFoundById("RoomType", cmd.Id));
            type.Update(code, cmd.Name, cmd.BaseRate, cmd.MaxAdults, cmd.MaxChildren, cmd.Description, cmd.Amenities, cmd.IsActive);

            // Rooms show their type by name; keep them in step with a rename.
            var rooms = await db.Rooms.Where(r => r.RoomTypeId == type.Id && !r.IsDeleted).ToListAsync(ct);
            foreach (var r in rooms)
                r.Update(r.RoomNumber, r.RoomTypeId, type.Name, r.Floor, r.Capacity, r.RatePerNight, r.View, r.HasBalcony, r.Notes);
        }
        await db.SaveChangesAsync(ct);
        var count = await db.Rooms.CountAsync(r => r.RoomTypeId == type.Id && !r.IsDeleted, ct);
        return Result.Success(SetupMappings.ToDto(type, count));
    }
}

internal sealed class DeleteRoomTypeHandler(HospitalityDbContext db) : ICommandHandler<DeleteRoomTypeCommand>
{
    public async Task<Result> Handle(DeleteRoomTypeCommand cmd, CancellationToken ct)
    {
        var type = await db.RoomTypes.FirstOrDefaultAsync(t => t.Id == cmd.Id && !t.IsDeleted, ct);
        if (type is null) return Result.Failure(Error.NotFoundById("RoomType", cmd.Id));
        var rooms = await db.Rooms.CountAsync(r => r.RoomTypeId == cmd.Id && !r.IsDeleted, ct);
        if (rooms > 0)
            return Result.Failure(SetupMappings.Conflict("RoomType", $"{rooms} room(s) are this type. Move them to another type first, or switch the type off."));
        type.Delete();
        db.SeasonalRates.RemoveRange(db.SeasonalRates.Where(s => s.RoomTypeId == cmd.Id));
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

// ── Rooms ────────────────────────────────────────────────────────────────────

internal sealed class UpsertRoomHandler(HospitalityDbContext db) : ICommandHandler<UpsertRoomCommand, RoomDto>
{
    public async Task<Result<RoomDto>> Handle(UpsertRoomCommand cmd, CancellationToken ct)
    {
        var number = cmd.RoomNumber.Trim();
        if (await db.Rooms.AnyAsync(r => !r.IsDeleted && r.RoomNumber == number && r.Id != cmd.Id, ct))
            return Result.Failure<RoomDto>(Error.Custom("Room.Duplicate", $"Room {number} already exists."));

        var type = await db.RoomTypes.FirstOrDefaultAsync(t => t.Id == cmd.RoomTypeId && !t.IsDeleted, ct);
        if (type is null) return Result.Failure<RoomDto>(Error.NotFoundById("RoomType", cmd.RoomTypeId));
        var capacity = cmd.Capacity > 0 ? cmd.Capacity : type.MaxOccupancy;

        Room room;
        if (cmd.Id is null)
        {
            room = new Room(number, type.Name, cmd.Floor, capacity, cmd.RatePerNight, cmd.View, cmd.HasBalcony);
            room.Update(number, type.Id, type.Name, cmd.Floor, capacity, cmd.RatePerNight, cmd.View, cmd.HasBalcony, cmd.Notes);
            db.Rooms.Add(room);
        }
        else
        {
            room = (await db.Rooms.FirstOrDefaultAsync(r => r.Id == cmd.Id && !r.IsDeleted, ct))!;
            if (room is null) return Result.Failure<RoomDto>(Error.NotFoundById("Room", cmd.Id));
            room.Update(number, type.Id, type.Name, cmd.Floor, capacity, cmd.RatePerNight, cmd.View, cmd.HasBalcony, cmd.Notes);
        }
        await db.SaveChangesAsync(ct);
        return Result.Success(RoomMappings.ToDto(room));
    }
}

internal sealed class DeleteRoomHandler(HospitalityDbContext db) : ICommandHandler<DeleteRoomCommand>
{
    public async Task<Result> Handle(DeleteRoomCommand cmd, CancellationToken ct)
    {
        var room = await db.Rooms.FirstOrDefaultAsync(r => r.Id == cmd.Id && !r.IsDeleted, ct);
        if (room is null) return Result.Failure(Error.NotFoundById("Room", cmd.Id));
        var open = await db.Bookings.CountAsync(b => b.RoomId == cmd.Id && !b.IsDeleted && Occupancy.Holding.Contains(b.Status), ct);
        if (open > 0)
            return Result.Failure(SetupMappings.Conflict("Room", $"Room {room.RoomNumber} has {open} upcoming or current booking(s). Move them first."));
        room.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class SetRoomMaintenanceHandler(HospitalityDbContext db) : ICommandHandler<SetRoomMaintenanceCommand, RoomDto>
{
    public async Task<Result<RoomDto>> Handle(SetRoomMaintenanceCommand cmd, CancellationToken ct)
    {
        var room = await db.Rooms.FirstOrDefaultAsync(r => r.Id == cmd.Id && !r.IsDeleted, ct);
        if (room is null) return Result.Failure<RoomDto>(Error.NotFoundById("Room", cmd.Id));
        if (cmd.InMaintenance)
        {
            if (room.CurrentBookingId is not null)
                return Result.Failure<RoomDto>(SetupMappings.Conflict("Room", $"Room {room.RoomNumber} has a guest in it. Move them first."));
            room.SetMaintenance();
        }
        else room.SetAvailable();
        await db.SaveChangesAsync(ct);
        return Result.Success(RoomMappings.ToDto(room));
    }
}

internal sealed class SetRoomHousekeepingHandler(HospitalityDbContext db) : ICommandHandler<SetRoomHousekeepingCommand, RoomDto>
{
    public async Task<Result<RoomDto>> Handle(SetRoomHousekeepingCommand cmd, CancellationToken ct)
    {
        var room = await db.Rooms.FirstOrDefaultAsync(r => r.Id == cmd.Id && !r.IsDeleted, ct);
        if (room is null) return Result.Failure<RoomDto>(Error.NotFoundById("Room", cmd.Id));
        room.SetHousekeeping(cmd.Status);
        await db.SaveChangesAsync(ct);
        return Result.Success(RoomMappings.ToDto(room));
    }
}

// ── Room blocks ──────────────────────────────────────────────────────────────

internal sealed class GetRoomBlocksHandler(HospitalityDbContext db) : IQueryHandler<GetRoomBlocksQuery, IReadOnlyList<RoomBlockDto>>
{
    public async Task<Result<IReadOnlyList<RoomBlockDto>>> Handle(GetRoomBlocksQuery q, CancellationToken ct)
    {
        var from = string.IsNullOrWhiteSpace(q.From) ? HotelDates.Today(null) : q.From!;
        var to = string.IsNullOrWhiteSpace(q.To) ? "9999-12-31" : q.To!;
        var blocks = await Occupancy.OverlappingBlocks(db, from, to).AsNoTracking().OrderBy(b => b.FromDate).ToListAsync(ct);
        return Result.Success<IReadOnlyList<RoomBlockDto>>(blocks.Select(SetupMappings.ToDto).ToList());
    }
}

internal sealed class CreateRoomBlockHandler(HospitalityDbContext db) : ICommandHandler<CreateRoomBlockCommand, RoomBlockDto>
{
    public async Task<Result<RoomBlockDto>> Handle(CreateRoomBlockCommand cmd, CancellationToken ct)
    {
        var room = await db.Rooms.FirstOrDefaultAsync(r => r.Id == cmd.RoomId && !r.IsDeleted, ct);
        if (room is null) return Result.Failure<RoomBlockDto>(Error.NotFoundById("Room", cmd.RoomId));

        // Blocking a room someone is booked into would leave that guest with nowhere to sleep.
        var clash = await Occupancy.Overlapping(db, cmd.FromDate, cmd.ToDate).Where(b => b.RoomId == room.Id)
            .Select(b => new { b.GuestName, b.BookingNumber }).FirstOrDefaultAsync(ct);
        if (clash is not null)
            return Result.Failure<RoomBlockDto>(SetupMappings.Conflict("RoomBlock",
                $"{clash.GuestName} ({clash.BookingNumber}) is booked into room {room.RoomNumber} on those dates. Move the booking first."));

        var block = new RoomBlock(room.Id, room.RoomNumber, cmd.FromDate, cmd.ToDate, cmd.Reason);
        db.RoomBlocks.Add(block);
        await db.SaveChangesAsync(ct);
        return Result.Success(SetupMappings.ToDto(block));
    }
}

internal sealed class DeleteRoomBlockHandler(HospitalityDbContext db) : ICommandHandler<DeleteRoomBlockCommand>
{
    public async Task<Result> Handle(DeleteRoomBlockCommand cmd, CancellationToken ct)
    {
        var block = await db.RoomBlocks.FirstOrDefaultAsync(b => b.Id == cmd.Id, ct);
        if (block is null) return Result.Failure(Error.NotFoundById("RoomBlock", cmd.Id));
        db.RoomBlocks.Remove(block);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

// ── Rate plans ───────────────────────────────────────────────────────────────

internal sealed class GetRatePlansHandler(HospitalityDbContext db) : IQueryHandler<GetRatePlansQuery, IReadOnlyList<RatePlanDto>>
{
    public async Task<Result<IReadOnlyList<RatePlanDto>>> Handle(GetRatePlansQuery q, CancellationToken ct)
    {
        await PmsBootstrap.DefaultPlanAsync(db, ct);
        var plans = await db.RatePlans.AsNoTracking().Where(p => !p.IsDeleted && (q.IncludeInactive || p.IsActive))
            .OrderByDescending(p => p.IsDefault).ThenBy(p => p.Name).ToListAsync(ct);
        var planIds = plans.Select(p => p.Id).ToList();
        var seasons = await db.SeasonalRates.AsNoTracking().Where(s => planIds.Contains(s.RatePlanId))
            .OrderBy(s => s.FromDate).ToListAsync(ct);
        var typeNames = await db.RoomTypes.AsNoTracking().ToDictionaryAsync(t => t.Id, t => t.Name, ct);
        return Result.Success<IReadOnlyList<RatePlanDto>>(plans
            .Select(p => SetupMappings.ToDto(p, seasons.Where(s => s.RatePlanId == p.Id), typeNames)).ToList());
    }
}

internal sealed class UpsertRatePlanHandler(HospitalityDbContext db) : ICommandHandler<UpsertRatePlanCommand, RatePlanDto>
{
    public async Task<Result<RatePlanDto>> Handle(UpsertRatePlanCommand cmd, CancellationToken ct)
    {
        var code = cmd.Code.Trim().ToUpperInvariant();
        if (await db.RatePlans.AnyAsync(p => !p.IsDeleted && p.Code == code && p.Id != cmd.Id, ct))
            return Result.Failure<RatePlanDto>(Error.Custom("RatePlan.Duplicate", $"A rate plan with code {code} already exists."));

        RatePlan plan;
        if (cmd.Id is null)
        {
            plan = new RatePlan(code, cmd.Name, cmd.MealPlan, cmd.IsRefundable, cmd.Description);
            db.RatePlans.Add(plan);
        }
        else
        {
            plan = (await db.RatePlans.FirstOrDefaultAsync(p => p.Id == cmd.Id && !p.IsDeleted, ct))!;
            if (plan is null) return Result.Failure<RatePlanDto>(Error.NotFoundById("RatePlan", cmd.Id));
            if (plan.IsDefault && !cmd.IsActive)
                return Result.Failure<RatePlanDto>(SetupMappings.Conflict("RatePlan", "The default plan cannot be switched off. Make another plan the default first."));
            plan.Update(code, cmd.Name, cmd.MealPlan, cmd.IsRefundable, cmd.Description, cmd.IsActive);
        }
        await db.SaveChangesAsync(ct);
        return Result.Success(await SetupMappings.ToDtoAsync(db, plan, ct));
    }
}

internal sealed class DeleteRatePlanHandler(HospitalityDbContext db) : ICommandHandler<DeleteRatePlanCommand>
{
    public async Task<Result> Handle(DeleteRatePlanCommand cmd, CancellationToken ct)
    {
        var plan = await db.RatePlans.FirstOrDefaultAsync(p => p.Id == cmd.Id && !p.IsDeleted, ct);
        if (plan is null) return Result.Failure(Error.NotFoundById("RatePlan", cmd.Id));
        if (plan.IsDefault)
            return Result.Failure(SetupMappings.Conflict("RatePlan", "The default plan cannot be deleted. Make another plan the default first."));
        // Bookings keep the plan's name; deleting only stops it being sold.
        plan.Delete();
        db.SeasonalRates.RemoveRange(db.SeasonalRates.Where(s => s.RatePlanId == cmd.Id));
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class SetDefaultRatePlanHandler(HospitalityDbContext db) : ICommandHandler<SetDefaultRatePlanCommand, RatePlanDto>
{
    public async Task<Result<RatePlanDto>> Handle(SetDefaultRatePlanCommand cmd, CancellationToken ct)
    {
        var plans = await db.RatePlans.Where(p => !p.IsDeleted).ToListAsync(ct);
        var plan = plans.FirstOrDefault(p => p.Id == cmd.Id);
        if (plan is null) return Result.Failure<RatePlanDto>(Error.NotFoundById("RatePlan", cmd.Id));
        if (!plan.IsActive) return Result.Failure<RatePlanDto>(SetupMappings.Conflict("RatePlan", "Switch the plan on before making it the default."));
        foreach (var p in plans) p.SetDefault(p.Id == plan.Id);
        await db.SaveChangesAsync(ct);
        return Result.Success(await SetupMappings.ToDtoAsync(db, plan, ct));
    }
}

internal sealed class AddSeasonalRateHandler(HospitalityDbContext db) : ICommandHandler<AddSeasonalRateCommand, RatePlanDto>
{
    public async Task<Result<RatePlanDto>> Handle(AddSeasonalRateCommand cmd, CancellationToken ct)
    {
        var plan = await db.RatePlans.FirstOrDefaultAsync(p => p.Id == cmd.RatePlanId && !p.IsDeleted, ct);
        if (plan is null) return Result.Failure<RatePlanDto>(Error.NotFoundById("RatePlan", cmd.RatePlanId));
        if (!await db.RoomTypes.AnyAsync(t => t.Id == cmd.RoomTypeId && !t.IsDeleted, ct))
            return Result.Failure<RatePlanDto>(Error.NotFoundById("RoomType", cmd.RoomTypeId));

        db.SeasonalRates.Add(new SeasonalRate(plan.Id, cmd.RoomTypeId, cmd.Label, cmd.FromDate, cmd.ToDate,
            cmd.WeekdayRate, cmd.WeekendRate, cmd.MinNights));
        await db.SaveChangesAsync(ct);
        return Result.Success(await SetupMappings.ToDtoAsync(db, plan, ct));
    }
}

internal sealed class DeleteSeasonalRateHandler(HospitalityDbContext db) : ICommandHandler<DeleteSeasonalRateCommand, RatePlanDto>
{
    public async Task<Result<RatePlanDto>> Handle(DeleteSeasonalRateCommand cmd, CancellationToken ct)
    {
        var plan = await db.RatePlans.FirstOrDefaultAsync(p => p.Id == cmd.RatePlanId && !p.IsDeleted, ct);
        if (plan is null) return Result.Failure<RatePlanDto>(Error.NotFoundById("RatePlan", cmd.RatePlanId));
        var season = await db.SeasonalRates.FirstOrDefaultAsync(s => s.Id == cmd.SeasonId && s.RatePlanId == plan.Id, ct);
        if (season is null) return Result.Failure<RatePlanDto>(Error.NotFoundById("SeasonalRate", cmd.SeasonId));
        // Bookings already taken keep their priced nights; removing a season only changes future quotes.
        db.SeasonalRates.Remove(season);
        await db.SaveChangesAsync(ct);
        return Result.Success(await SetupMappings.ToDtoAsync(db, plan, ct));
    }
}

// ── Settings ─────────────────────────────────────────────────────────────────

internal sealed class GetHotelSettingsHandler(HospitalityDbContext db) : IQueryHandler<GetHotelSettingsQuery, HotelSettingsDto>
{
    public async Task<Result<HotelSettingsDto>> Handle(GetHotelSettingsQuery q, CancellationToken ct) =>
        Result.Success(SetupMappings.ToDto(await PmsBootstrap.SettingsAsync(db, ct)));
}

internal sealed class UpdateHotelSettingsHandler(HospitalityDbContext db) : ICommandHandler<UpdateHotelSettingsCommand, HotelSettingsDto>
{
    public async Task<Result<HotelSettingsDto>> Handle(UpdateHotelSettingsCommand cmd, CancellationToken ct)
    {
        var s = await PmsBootstrap.SettingsAsync(db, ct);
        var weekend = string.Join(',', cmd.WeekendDays.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(d => HotelSettings.DayNames.First(n => n.Equals(d, StringComparison.OrdinalIgnoreCase))).Distinct());
        // New rates apply to bookings taken from now on; each booking keeps the tax and service it was sold with.
        s.Update(cmd.PropertyName, weekend, cmd.CheckInTime, cmd.CheckOutTime, cmd.TaxPercent, cmd.TaxLabel,
            cmd.ServiceChargePercent, cmd.NightlyFee, cmd.NightlyFeeLabel);
        await db.SaveChangesAsync(ct);
        return Result.Success(SetupMappings.ToDto(s));
    }
}
