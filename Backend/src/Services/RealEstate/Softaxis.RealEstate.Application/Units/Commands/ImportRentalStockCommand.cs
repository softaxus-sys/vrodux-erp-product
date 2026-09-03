using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.RealEstate.Application.Properties.Commands;

namespace Softaxis.RealEstate.Application.Units.Commands;

/// <summary>
/// Imports an agency rental-stock sheet: one row per apartment being marketed, listing its building,
/// size, rent and owner.
///
/// <para>Distinct from the plain unit import because the shape is different. The building is created
/// on the fly from its name — these sheets carry no property register — and the columns are written
/// for people: rent as "48K/2CQ.", beds as "2bhk+maids".</para>
/// </summary>
public sealed record ImportRentalStockCommand(IReadOnlyList<RentalStockRow> Rows)
    : ICommand<RentalStockImportResult>;

public sealed record RentalStockRow(
    /// <summary>The building. Required — a unit with no building cannot be placed.</summary>
    string  Building,
    string? Location    = null,
    string? PropertyType = null,
    /// <summary>Rarely present in these sheets; a placeholder is generated when it is missing.</summary>
    string? UnitNumber  = null,
    string? Beds        = null,
    string? Price       = null,
    string? Area        = null,
    string? Furnishing  = null,
    string? Occupancy   = null,
    string? View        = null,
    string? OwnerName   = null,
    string? OwnerPhone  = null,
    string? Agent       = null);

/// <summary>
/// Counts both halves, because "312 units created" alone does not tell you whether it also invented
/// 198 buildings — which is the thing worth knowing before it happens.
/// </summary>
public sealed record RentalStockImportResult(
    int PropertiesCreated,
    int UnitsCreated,
    int Skipped,
    int Failed,
    /// <summary>Rows whose rent could not be read, and other per-row notes.</summary>
    IReadOnlyList<ImportRowProblem> Problems);

public sealed class ImportRentalStockValidator : AbstractValidator<ImportRentalStockCommand>
{
    public const int MaxRows = 2000;

    public ImportRentalStockValidator()
    {
        RuleFor(x => x.Rows).NotNull()
            .Must(r => r.Count > 0).WithMessage("No rows to import.")
            .Must(r => r.Count <= MaxRows)
            .WithMessage($"Too many rows in one request (max {MaxRows}). The importer splits larger files.");
    }
}
