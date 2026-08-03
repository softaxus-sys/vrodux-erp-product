using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.DeliveryOrders.Dtos;

namespace Softaxis.Restaurant.Application.DeliveryOrders.Commands;

/// <summary>Creates the delivery leg for an existing (delivery-type) order — dispatches through the
/// given provider (default "manual" = in-house driver pool).</summary>
public sealed record CreateDeliveryOrderCommand(
    Guid OrderId, string Address, string Phone, Guid? DeliveryZoneId, string ProviderKey = "manual"
) : ICommand<DeliveryOrderDto>;

public sealed class CreateDeliveryOrderValidator : AbstractValidator<CreateDeliveryOrderCommand>
{
    public CreateDeliveryOrderValidator()
    {
        RuleFor(x => x.Address).NotEmpty().MaximumLength(500);
        RuleFor(x => x.Phone).NotEmpty().MaximumLength(50);
        RuleFor(x => x.ProviderKey).NotEmpty();
    }
}

public sealed record AssignDriverToDeliveryCommand(Guid DeliveryOrderId, Guid DriverId) : ICommand<DeliveryOrderDto>;

public sealed record ChangeDeliveryStatusCommand(Guid DeliveryOrderId, string Status) : ICommand<DeliveryOrderDto>;

public sealed class ChangeDeliveryStatusValidator : AbstractValidator<ChangeDeliveryStatusCommand>
{
    private static readonly string[] Allowed = ["picked_up", "enroute", "delivered", "failed"];
    public ChangeDeliveryStatusValidator() =>
        RuleFor(x => x.Status).Must(s => Allowed.Contains(s)).WithMessage($"Status must be one of: {string.Join(", ", Allowed)}.");
}
