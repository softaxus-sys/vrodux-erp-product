using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Fitness.Application.Members;

namespace Softaxis.Fitness.Application.Classes;

public sealed record ClassTypeDto(Guid Id, string Name, string? Description, string? Level, int DurationMinutes,
    int Capacity, string? Color, int CreditCost, decimal DropInPrice, bool IsActive);

public sealed record GetClassTypesQuery(bool ActiveOnly = false) : IQuery<IReadOnlyList<ClassTypeDto>>;

public sealed record SaveClassTypeCommand(Guid? Id, string Name, string? Description, string? Level,
    int DurationMinutes, int Capacity, string? Color, int CreditCost, decimal DropInPrice, bool IsActive = true) : ICommand<ClassTypeDto>;

public sealed record DeleteClassTypeCommand(Guid Id) : ICommand;

public sealed class SaveClassTypeValidator : AbstractValidator<SaveClassTypeCommand>
{
    public SaveClassTypeValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("Class name is required.").MaximumLength(120);
        RuleFor(x => x.DurationMinutes).InclusiveBetween(5, 480);
        RuleFor(x => x.Capacity).InclusiveBetween(1, 1000);
        RuleFor(x => x.CreditCost).InclusiveBetween(0, 20);
        RuleFor(x => x.DropInPrice).GreaterThanOrEqualTo(0);
    }
}

public sealed record SessionDto(Guid Id, Guid ClassTypeId, string ClassName, string? Color, Guid BranchId,
    string? BranchName, Guid? TrainerId, string? TrainerName, string Date, string StartTime, string EndTime,
    int Capacity, int CreditCost, string? Room, string? Notes, string Status, string? CancelReason, Guid? SeriesId,
    int Booked, int Waitlisted, int Attended);

public sealed record GetSessionsQuery(string From, string To, Guid? BranchId, Guid? TrainerId, Guid? ClassTypeId,
    bool IncludeCancelled = true) : IQuery<IReadOnlyList<SessionDto>>;

/// <summary>Schedule a class. With RepeatWeeks &gt; 0 it repeats on the given weekdays (0 = Sunday).</summary>
public sealed record ScheduleClassCommand(Guid ClassTypeId, Guid BranchId, Guid? TrainerId, string Date,
    string StartTime, int? DurationMinutes, int? Capacity, string? Room, string? Notes, int RepeatWeeks,
    IReadOnlyList<int>? Weekdays) : ICommand<IReadOnlyList<SessionDto>>;

public sealed record UpdateSessionCommand(Guid Id, Guid? TrainerId, string Date, string StartTime, string EndTime,
    int Capacity, string? Room, string? Notes, bool ApplyToSeries) : ICommand<SessionDto>;

public sealed record CancelSessionCommand(Guid Id, string? Reason, bool CancelSeries) : ICommand<int>;
public sealed record CompleteSessionCommand(Guid Id, bool MarkUnattendedAsNoShow) : ICommand<SessionDto>;
public sealed record DeleteSessionCommand(Guid Id) : ICommand;

public sealed class ScheduleClassValidator : AbstractValidator<ScheduleClassCommand>
{
    public ScheduleClassValidator()
    {
        RuleFor(x => x.Date).Must(Dates.Valid).WithMessage("Use yyyy-MM-dd.");
        RuleFor(x => x.StartTime).Matches("^([01]\\d|2[0-3]):[0-5]\\d$").WithMessage("Use HH:mm.");
        RuleFor(x => x.RepeatWeeks).InclusiveBetween(0, 52);
        RuleFor(x => x.Capacity).InclusiveBetween(1, 1000).When(x => x.Capacity.HasValue);
        RuleFor(x => x.DurationMinutes).InclusiveBetween(5, 480).When(x => x.DurationMinutes.HasValue);
        RuleForEach(x => x.Weekdays).InclusiveBetween(0, 6);
    }
}

public sealed class UpdateSessionValidator : AbstractValidator<UpdateSessionCommand>
{
    public UpdateSessionValidator()
    {
        RuleFor(x => x.Date).Must(Dates.Valid).WithMessage("Use yyyy-MM-dd.");
        RuleFor(x => x.StartTime).Matches("^([01]\\d|2[0-3]):[0-5]\\d$");
        RuleFor(x => x.EndTime).Matches("^([01]\\d|2[0-3]):[0-5]\\d$");
        RuleFor(x => x).Must(x => string.CompareOrdinal(x.EndTime, x.StartTime) > 0).WithMessage("End time must be after the start.");
        RuleFor(x => x.Capacity).InclusiveBetween(1, 1000);
    }
}

public sealed record BookingDto(Guid Id, Guid SessionId, Guid MemberId, string MemberName, string MemberNumber,
    string? Phone, string Status, int? WaitlistPosition, bool CreditUsed, DateTime BookedAt, DateTime? CancelledAt,
    string? ClassName, string? Date, string? StartTime);

public sealed record GetBookingsQuery(Guid? SessionId, Guid? MemberId, bool UpcomingOnly, string? Today) : IQuery<IReadOnlyList<BookingDto>>;

public sealed record BookClassCommand(Guid SessionId, Guid MemberId, bool AllowWaitlist, string? Today, string? LocalTime) : ICommand<BookingDto>;
public sealed record CancelBookingCommand(Guid Id, string? Today, string? LocalTime) : ICommand<BookingDto>;
/// <summary>attended | no_show | booked (to undo).</summary>
public sealed record MarkAttendanceCommand(Guid Id, string Status) : ICommand<BookingDto>;
