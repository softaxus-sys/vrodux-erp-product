using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Tables.Dtos;

namespace Softaxis.Restaurant.Application.Tables.Commands;

/// <summary>Manually set a table's status — available/reserved/cleaning. (Tables go "occupied" only via
/// order creation, and back to "cleaning" automatically once an order is fully paid.)</summary>
public sealed record UpdateTableStatusCommand(
    Guid Id,
    string Status
) : ICommand<TableDto>;

public sealed class UpdateTableStatusValidator : AbstractValidator<UpdateTableStatusCommand>
{
    private static readonly string[] AllowedStatuses = ["available", "reserved", "cleaning"];

    public UpdateTableStatusValidator()
    {
        RuleFor(x => x.Status)
            .Must(s => AllowedStatuses.Contains(s))
            .WithMessage($"Status must be one of: {string.Join(", ", AllowedStatuses)}.");
    }
}
