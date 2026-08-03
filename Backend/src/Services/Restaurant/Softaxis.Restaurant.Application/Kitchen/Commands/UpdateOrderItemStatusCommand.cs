using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Restaurant.Application.Kitchen.Commands;

/// <summary>PATCH /api/restaurant/kitchen/items/{id}/status — pending/preparing/ready/served.</summary>
public sealed record UpdateOrderItemStatusCommand(Guid ItemId, string Status) : ICommand<UpdateOrderItemStatusResult>;

public sealed record UpdateOrderItemStatusResult(Guid Id, string Status);

public sealed class UpdateOrderItemStatusValidator : AbstractValidator<UpdateOrderItemStatusCommand>
{
    private static readonly string[] AllowedStatuses = ["pending", "preparing", "ready", "served"];

    public UpdateOrderItemStatusValidator()
    {
        RuleFor(x => x.Status)
            .Must(s => AllowedStatuses.Contains(s))
            .WithMessage($"Status must be one of: {string.Join(", ", AllowedStatuses)}.");
    }
}
