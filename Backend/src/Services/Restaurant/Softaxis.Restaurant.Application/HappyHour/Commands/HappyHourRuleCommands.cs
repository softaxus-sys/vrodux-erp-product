using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.HappyHour.Dtos;

namespace Softaxis.Restaurant.Application.HappyHour.Commands;

public sealed record CreateHappyHourRuleCommand(
    string Name, int DaysOfWeekMask, string StartTime, string EndTime,
    string DiscountType, decimal DiscountValue, Guid? CategoryId, Guid? BranchId = null
) : ICommand<HappyHourRuleDto>;

public sealed class CreateHappyHourRuleValidator : AbstractValidator<CreateHappyHourRuleCommand>
{
    public CreateHappyHourRuleValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        RuleFor(x => x.StartTime).Must(s => TimeSpan.TryParse(s, out _)).WithMessage("Start time must be HH:mm.");
        RuleFor(x => x.EndTime).Must(s => TimeSpan.TryParse(s, out _)).WithMessage("End time must be HH:mm.");
        RuleFor(x => x.DiscountType).Must(t => t is "percentage" or "flat").WithMessage("Discount type must be 'percentage' or 'flat'.");
        RuleFor(x => x.DiscountValue).GreaterThan(0);
        RuleFor(x => x.DaysOfWeekMask).InclusiveBetween(1, 127).WithMessage("At least one day of the week must be selected.");
    }
}

public sealed record UpdateHappyHourRuleCommand(
    Guid Id, string Name, int DaysOfWeekMask, string StartTime, string EndTime,
    string DiscountType, decimal DiscountValue, Guid? CategoryId, bool IsActive
) : ICommand<HappyHourRuleDto>;

public sealed class UpdateHappyHourRuleValidator : AbstractValidator<UpdateHappyHourRuleCommand>
{
    public UpdateHappyHourRuleValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        RuleFor(x => x.StartTime).Must(s => TimeSpan.TryParse(s, out _)).WithMessage("Start time must be HH:mm.");
        RuleFor(x => x.EndTime).Must(s => TimeSpan.TryParse(s, out _)).WithMessage("End time must be HH:mm.");
        RuleFor(x => x.DiscountType).Must(t => t is "percentage" or "flat").WithMessage("Discount type must be 'percentage' or 'flat'.");
        RuleFor(x => x.DiscountValue).GreaterThan(0);
        RuleFor(x => x.DaysOfWeekMask).InclusiveBetween(1, 127).WithMessage("At least one day of the week must be selected.");
    }
}

public sealed record DeleteHappyHourRuleCommand(Guid Id) : ICommand;
