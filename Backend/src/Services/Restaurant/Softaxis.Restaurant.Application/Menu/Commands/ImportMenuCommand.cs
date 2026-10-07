using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Menu.Dtos;

namespace Softaxis.Restaurant.Application.Menu.Commands;

/// <summary>POST /api/restaurant/menu/import — categories and dishes from a spreadsheet, in one call.
/// A category is created the first time a row names it; photos are not part of this command (the
/// client uploads them afterwards through the ordinary dish-photo endpoint, using the ids returned).</summary>
public sealed record ImportMenuCommand(IReadOnlyList<ImportMenuRow> Rows) : ICommand<ImportMenuResultDto>;

public sealed record ImportMenuRow(
    string? Category,
    string? Name,
    decimal Price,
    string? Description = null,
    int? PrepTimeMinutes = null,
    string? Allergens = null,
    string? CategoryDescription = null);

public sealed class ImportMenuValidator : AbstractValidator<ImportMenuCommand>
{
    public const int MaxRows = 2000;

    public ImportMenuValidator()
    {
        RuleFor(x => x.Rows).NotNull()
            .Must(r => r.Count > 0).WithMessage("The file has no rows to import.")
            .Must(r => r.Count <= MaxRows).WithMessage($"Too many rows in one import (max {MaxRows}).");
    }
}
