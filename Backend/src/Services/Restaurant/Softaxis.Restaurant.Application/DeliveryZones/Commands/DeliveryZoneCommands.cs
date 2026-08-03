using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.DeliveryZones.Dtos;

namespace Softaxis.Restaurant.Application.DeliveryZones.Commands;

public sealed record CreateDeliveryZoneCommand(
    string Name, string? PostalCodesJson, decimal DeliveryFee, decimal MinOrderAmount, int EstimatedMinutes, Guid? BranchId = null
) : ICommand<DeliveryZoneDto>;

public sealed class CreateDeliveryZoneValidator : AbstractValidator<CreateDeliveryZoneCommand>
{
    public CreateDeliveryZoneValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        RuleFor(x => x.DeliveryFee).GreaterThanOrEqualTo(0);
        RuleFor(x => x.MinOrderAmount).GreaterThanOrEqualTo(0);
        RuleFor(x => x.EstimatedMinutes).GreaterThan(0);
    }
}

public sealed record UpdateDeliveryZoneCommand(
    Guid Id, string Name, string? PostalCodesJson, decimal DeliveryFee, decimal MinOrderAmount, int EstimatedMinutes, bool IsActive
) : ICommand<DeliveryZoneDto>;

public sealed class UpdateDeliveryZoneValidator : AbstractValidator<UpdateDeliveryZoneCommand>
{
    public UpdateDeliveryZoneValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        RuleFor(x => x.DeliveryFee).GreaterThanOrEqualTo(0);
        RuleFor(x => x.MinOrderAmount).GreaterThanOrEqualTo(0);
        RuleFor(x => x.EstimatedMinutes).GreaterThan(0);
    }
}

public sealed record DeleteDeliveryZoneCommand(Guid Id) : ICommand;
