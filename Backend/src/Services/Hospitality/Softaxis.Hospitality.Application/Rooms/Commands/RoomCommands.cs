using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Hospitality.Application.Rooms.Dtos;
using Softaxis.Hospitality.Domain.Entities;

namespace Softaxis.Hospitality.Application.Rooms.Commands;

internal static class RoomRules
{
    public static bool IsDate(string? s) => DateOnly.TryParseExact(s, "yyyy-MM-dd", out _);
    public static bool IsTime(string? s) => TimeOnly.TryParseExact(s, "HH:mm", out _);
}

// ── Room types ───────────────────────────────────────────────────────────────

public sealed record UpsertRoomTypeCommand(
    Guid? Id, string Code, string Name, decimal BaseRate, int MaxAdults, int MaxChildren,
    string? Description, string? Amenities, bool IsActive = true) : ICommand<RoomTypeDto>;

public sealed class UpsertRoomTypeValidator : AbstractValidator<UpsertRoomTypeCommand>
{
    public UpsertRoomTypeValidator()
    {
        RuleFor(x => x.Code).NotEmpty().MaximumLength(20);
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        RuleFor(x => x.BaseRate).GreaterThanOrEqualTo(0);
        RuleFor(x => x.MaxAdults).InclusiveBetween(1, 20);
        RuleFor(x => x.MaxChildren).InclusiveBetween(0, 20);
    }
}

public sealed record DeleteRoomTypeCommand(Guid Id) : ICommand;

// ── Rooms ────────────────────────────────────────────────────────────────────

/// <summary>Rate 0 = sell at the room type's rate. Capacity 0 = the type's maximum occupancy.</summary>
public sealed record UpsertRoomCommand(
    Guid? Id, string RoomNumber, Guid RoomTypeId, int Floor, int Capacity, decimal RatePerNight,
    string? View, bool HasBalcony, string? Notes) : ICommand<RoomDto>;

public sealed class UpsertRoomValidator : AbstractValidator<UpsertRoomCommand>
{
    public UpsertRoomValidator()
    {
        RuleFor(x => x.RoomNumber).NotEmpty().MaximumLength(20);
        RuleFor(x => x.RoomTypeId).NotEmpty().WithMessage("Pick a room type.");
        RuleFor(x => x.Floor).InclusiveBetween(-5, 300);
        RuleFor(x => x.Capacity).InclusiveBetween(0, 40);
        RuleFor(x => x.RatePerNight).GreaterThanOrEqualTo(0);
    }
}

public sealed record DeleteRoomCommand(Guid Id) : ICommand;

/// <summary>Takes a room out of service indefinitely, or puts it back.</summary>
public sealed record SetRoomMaintenanceCommand(Guid Id, bool InMaintenance) : ICommand<RoomDto>;

public sealed record SetRoomHousekeepingCommand(Guid Id, string Status) : ICommand<RoomDto>;

public sealed class SetRoomHousekeepingValidator : AbstractValidator<SetRoomHousekeepingCommand>
{
    public SetRoomHousekeepingValidator() =>
        RuleFor(x => x.Status).Must(s => s is "clean" or "dirty" or "inspected").WithMessage("clean, dirty or inspected.");
}

/// <summary>Out of order for a run of nights; ToDate is the first night back in service.</summary>
public sealed record CreateRoomBlockCommand(Guid RoomId, string FromDate, string ToDate, string Reason) : ICommand<RoomBlockDto>;

public sealed class CreateRoomBlockValidator : AbstractValidator<CreateRoomBlockCommand>
{
    public CreateRoomBlockValidator()
    {
        RuleFor(x => x.FromDate).Must(RoomRules.IsDate).WithMessage("From date must be yyyy-MM-dd.");
        RuleFor(x => x.ToDate).Must(RoomRules.IsDate).WithMessage("To date must be yyyy-MM-dd.");
        RuleFor(x => x).Must(x => string.CompareOrdinal(x.ToDate, x.FromDate) > 0)
            .When(x => RoomRules.IsDate(x.FromDate) && RoomRules.IsDate(x.ToDate))
            .WithMessage("The block must cover at least one night.");
        RuleFor(x => x.Reason).NotEmpty().MaximumLength(500);
    }
}

public sealed record DeleteRoomBlockCommand(Guid Id) : ICommand;

// ── Rate plans ───────────────────────────────────────────────────────────────

public sealed record UpsertRatePlanCommand(
    Guid? Id, string Code, string Name, string MealPlan, bool IsRefundable, string? Description,
    bool IsActive = true) : ICommand<RatePlanDto>;

public sealed class UpsertRatePlanValidator : AbstractValidator<UpsertRatePlanCommand>
{
    public UpsertRatePlanValidator()
    {
        RuleFor(x => x.Code).NotEmpty().MaximumLength(20);
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        RuleFor(x => x.MealPlan).Must(m => RatePlan.MealPlans.Contains(m?.Trim().ToLowerInvariant()))
            .WithMessage("Meal plan: room_only, bed_breakfast, half_board, full_board or all_inclusive.");
    }
}

public sealed record DeleteRatePlanCommand(Guid Id) : ICommand;

public sealed record SetDefaultRatePlanCommand(Guid Id) : ICommand<RatePlanDto>;

public sealed record AddSeasonalRateCommand(
    Guid RatePlanId, Guid RoomTypeId, string Label, string FromDate, string ToDate,
    decimal WeekdayRate, decimal? WeekendRate, int MinNights = 1) : ICommand<RatePlanDto>;

public sealed class AddSeasonalRateValidator : AbstractValidator<AddSeasonalRateCommand>
{
    public AddSeasonalRateValidator()
    {
        RuleFor(x => x.Label).NotEmpty().MaximumLength(100);
        RuleFor(x => x.FromDate).Must(RoomRules.IsDate).WithMessage("From date must be yyyy-MM-dd.");
        RuleFor(x => x.ToDate).Must(RoomRules.IsDate).WithMessage("To date must be yyyy-MM-dd.");
        RuleFor(x => x).Must(x => string.CompareOrdinal(x.ToDate, x.FromDate) >= 0)
            .When(x => RoomRules.IsDate(x.FromDate) && RoomRules.IsDate(x.ToDate))
            .WithMessage("The season ends before it starts.");
        RuleFor(x => x.WeekdayRate).GreaterThan(0);
        RuleFor(x => x.WeekendRate).GreaterThan(0).When(x => x.WeekendRate.HasValue);
        RuleFor(x => x.MinNights).InclusiveBetween(1, 60);
    }
}

public sealed record DeleteSeasonalRateCommand(Guid RatePlanId, Guid SeasonId) : ICommand<RatePlanDto>;

// ── Settings ─────────────────────────────────────────────────────────────────

public sealed record UpdateHotelSettingsCommand(
    string? PropertyName, string WeekendDays, string CheckInTime, string CheckOutTime,
    decimal TaxPercent, string TaxLabel, decimal ServiceChargePercent, decimal NightlyFee,
    string? NightlyFeeLabel) : ICommand<HotelSettingsDto>;

public sealed class UpdateHotelSettingsValidator : AbstractValidator<UpdateHotelSettingsCommand>
{
    public UpdateHotelSettingsValidator()
    {
        RuleFor(x => x.WeekendDays).Must(d => (d ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .All(x => HotelSettings.DayNames.Contains(x, StringComparer.OrdinalIgnoreCase)))
            .WithMessage("Weekend days are day names: Sun, Mon, Tue, Wed, Thu, Fri, Sat.");
        RuleFor(x => x.CheckInTime).Must(RoomRules.IsTime).WithMessage("Check-in time is HH:mm.");
        RuleFor(x => x.CheckOutTime).Must(RoomRules.IsTime).WithMessage("Check-out time is HH:mm.");
        RuleFor(x => x.TaxPercent).InclusiveBetween(0, 100);
        RuleFor(x => x.ServiceChargePercent).InclusiveBetween(0, 100);
        RuleFor(x => x.NightlyFee).GreaterThanOrEqualTo(0);
    }
}
