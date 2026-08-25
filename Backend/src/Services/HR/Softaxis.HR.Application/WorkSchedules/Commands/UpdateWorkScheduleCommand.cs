using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.HR.Application.WorkSchedules.Dtos;

namespace Softaxis.HR.Application.WorkSchedules.Commands;

public sealed record UpdateWorkScheduleCommand(
    string   Name,
    string   StartTime,
    string   EndTime,
    int      GraceMinutes,
    IReadOnlyList<int> WorkingDays,
    string   TimeZoneId) : ICommand<WorkScheduleDto>;

public sealed class UpdateWorkScheduleCommandValidator : AbstractValidator<UpdateWorkScheduleCommand>
{
    public UpdateWorkScheduleCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(80);

        RuleFor(x => x.StartTime).Matches(@"^([01]\d|2[0-3]):[0-5]\d$")
            .WithMessage("Start time must be HH:mm.");
        RuleFor(x => x.EndTime).Matches(@"^([01]\d|2[0-3]):[0-5]\d$")
            .WithMessage("End time must be HH:mm.");

        // Nothing forbids a night shift that ends "before" it starts, so equality is the only
        // genuinely meaningless case.
        RuleFor(x => x).Must(x => x.StartTime != x.EndTime)
            .WithMessage("Start and end time cannot be the same.");

        RuleFor(x => x.GraceMinutes).InclusiveBetween(0, 240);

        RuleFor(x => x.WorkingDays).NotEmpty().WithMessage("Choose at least one working day.");
        RuleForEach(x => x.WorkingDays).InclusiveBetween(0, 6);

        RuleFor(x => x.TimeZoneId).NotEmpty().MaximumLength(80);
    }
}
