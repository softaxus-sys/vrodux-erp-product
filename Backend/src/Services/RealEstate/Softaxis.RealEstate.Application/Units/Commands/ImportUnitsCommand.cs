using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.RealEstate.Application.Properties.Commands;

namespace Softaxis.RealEstate.Application.Units.Commands;

/// <summary>
/// Bulk unit import from a spreadsheet.
///
/// <para>A unit only means something inside a building, so each row names its property rather than
/// carrying an id: a spreadsheet exported from a developer or typed by an agent has building names,
/// not our GUIDs. <see cref="PropertyId"/> is the override for "import this whole sheet into the
/// property I am looking at", which is how the Units page uses it.</para>
/// </summary>
public sealed record ImportUnitsCommand(
    IReadOnlyList<ImportUnitRow> Rows,
    /// <summary>When set, every row lands in this property and PropertyName is ignored.</summary>
    Guid? PropertyId = null) : ICommand<ImportResult>;

public sealed record ImportUnitRow(
    string  UnitNumber,
    /// <summary>Matched case-insensitively against the property name, then its property number.</summary>
    string? PropertyName  = null,
    string? UnitType      = null,
    // Numbers arrive as text for the reason given on ImportPropertyRow.
    string? Area          = null,
    string? Floor         = null,
    string? RentPerYear   = null,
    string? SalePrice     = null,
    string? Furnishing    = null,
    string? View          = null,
    string? Bedrooms      = null,
    string? Bathrooms     = null,
    string? Parking       = null,
    string? ServiceCharge = null,
    string? Notes         = null);

public sealed class ImportUnitsValidator : AbstractValidator<ImportUnitsCommand>
{
    public const int MaxRows = 2000;

    public ImportUnitsValidator()
    {
        RuleFor(x => x.Rows).NotNull()
            .Must(r => r.Count > 0).WithMessage("No rows to import.")
            .Must(r => r.Count <= MaxRows)
            .WithMessage($"Too many rows in one request (max {MaxRows}). The importer splits larger files.");
    }
}
