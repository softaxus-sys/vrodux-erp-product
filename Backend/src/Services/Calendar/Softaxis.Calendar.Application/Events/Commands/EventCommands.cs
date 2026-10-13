using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Calendar.Application.Events.Dtos;

namespace Softaxis.Calendar.Application.Events.Commands;

/// <param name="StartUtc">UTC instant; for an all-day event, midnight UTC of the first day.</param>
/// <param name="EndUtc">UTC instant; for an all-day event, midnight UTC of the day AFTER the last day.</param>
/// <param name="AddMeet">Ask Google to attach a Meet link (needs the owner's Google connection).</param>
public sealed record CreateEventCommand(
    string Title, string? Description, string? Location,
    DateTime StartUtc, DateTime EndUtc, bool IsAllDay, string? TimeZone,
    IReadOnlyList<AttendeeInput>? Attendees, bool AddMeet) : ICommand<CalendarEventDto>;

public sealed record UpdateEventCommand(
    Guid Id, string Title, string? Description, string? Location,
    DateTime StartUtc, DateTime EndUtc, bool IsAllDay, string? TimeZone,
    IReadOnlyList<AttendeeInput>? Attendees, bool AddMeet) : ICommand<CalendarEventDto>;

public sealed record DeleteEventCommand(Guid Id) : ICommand;

internal static class EventRules
{
    public static void Apply<T>(AbstractValidator<T> v,
        Func<T, string> title, Func<T, DateTime> start, Func<T, DateTime> end,
        Func<T, IReadOnlyList<AttendeeInput>?> attendees)
    {
        v.RuleFor(x => title(x)).NotEmpty().WithMessage("Title is required.")
            .MaximumLength(300).WithMessage("Title is too long (300 characters at most).");
        v.RuleFor(x => end(x)).Must((x, e) => e > start(x)).WithMessage("The event must end after it starts.");
        v.RuleFor(x => attendees(x)).Must(a => a is null || a.Count <= 100)
            .WithMessage("An event can have at most 100 guests.");
        v.RuleFor(x => attendees(x)).Must(a => a is null || a.All(p => p.Email.Contains('@') && p.Email.Length <= 320))
            .WithMessage("Every guest needs a valid email address.");
    }
}

public sealed class CreateEventValidator : AbstractValidator<CreateEventCommand>
{
    public CreateEventValidator() =>
        EventRules.Apply(this, c => c.Title, c => c.StartUtc, c => c.EndUtc, c => c.Attendees);
}

public sealed class UpdateEventValidator : AbstractValidator<UpdateEventCommand>
{
    public UpdateEventValidator() =>
        EventRules.Apply(this, c => c.Title, c => c.StartUtc, c => c.EndUtc, c => c.Attendees);
}
