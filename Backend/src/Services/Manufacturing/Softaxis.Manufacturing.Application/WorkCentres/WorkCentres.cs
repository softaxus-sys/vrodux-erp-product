using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Manufacturing.Application.WorkCentres;

public sealed record WorkCentreDto(
    Guid Id, string Name, string? Code, decimal LabourRatePerHour, decimal OverheadRatePerHour, bool IsActive,
    decimal CapacityHoursPerDay);

public sealed record GetWorkCentresQuery(bool ActiveOnly = false) : IQuery<IReadOnlyList<WorkCentreDto>>;

public sealed record CreateWorkCentreCommand(
    string Name, string? Code, decimal LabourRatePerHour, decimal OverheadRatePerHour,
    decimal CapacityHoursPerDay = 8) : ICommand<WorkCentreDto>;

public sealed record UpdateWorkCentreCommand(
    Guid Id, string Name, string? Code, decimal LabourRatePerHour, decimal OverheadRatePerHour, bool IsActive,
    decimal CapacityHoursPerDay = 8) : ICommand<WorkCentreDto>;

public sealed record DeleteWorkCentreCommand(Guid Id) : ICommand;

public sealed class CreateWorkCentreValidator : AbstractValidator<CreateWorkCentreCommand>
{
    public CreateWorkCentreValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Code).MaximumLength(30);
        RuleFor(x => x.LabourRatePerHour).GreaterThanOrEqualTo(0);
        RuleFor(x => x.OverheadRatePerHour).GreaterThanOrEqualTo(0);
        RuleFor(x => x.CapacityHoursPerDay).InclusiveBetween(0.25m, 24).WithMessage("Capacity must be between 15 minutes and 24 hours a day.");
    }
}

public sealed class UpdateWorkCentreValidator : AbstractValidator<UpdateWorkCentreCommand>
{
    public UpdateWorkCentreValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Code).MaximumLength(30);
        RuleFor(x => x.LabourRatePerHour).GreaterThanOrEqualTo(0);
        RuleFor(x => x.OverheadRatePerHour).GreaterThanOrEqualTo(0);
        RuleFor(x => x.CapacityHoursPerDay).InclusiveBetween(0.25m, 24).WithMessage("Capacity must be between 15 minutes and 24 hours a day.");
    }
}
