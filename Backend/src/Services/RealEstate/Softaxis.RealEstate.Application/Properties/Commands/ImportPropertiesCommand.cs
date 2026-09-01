using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.RealEstate.Application.Properties.Commands;

/// <summary>
/// Bulk property import from a spreadsheet. Mirrors the CRM lead importer: one request carries many
/// rows, a bad row is counted and skipped rather than aborting the batch, and the importer chunks
/// anything larger than <see cref="ImportPropertiesValidator.MaxRows"/>.
/// </summary>
public sealed record ImportPropertiesCommand(IReadOnlyList<ImportPropertyRow> Rows)
    : ICommand<ImportResult>;

/// <summary>
/// One spreadsheet row. Every field except the name is optional — a portfolio handover usually
/// arrives with the building list first and the detail filled in later, and rejecting a row for a
/// missing market value would make the import useless for exactly that case.
/// </summary>
/// <remarks>
/// Every field is a string, including the numbers. A spreadsheet cell is text — "1,200.00",
/// "AED 4.5M", or blank — and System.Text.Json rejects a quoted value for a decimal outright, which
/// would fail the entire batch on one oddly formatted cell. Parsed leniently in the handler instead,
/// so a cell that cannot be read falls back to zero and the row still imports.
/// </remarks>
public sealed record ImportPropertyRow(
    string  Name,
    string? PropertyType = null,
    string? Address      = null,
    string? City         = null,
    string? Emirate      = null,
    string? TotalArea    = null,
    string? MarketValue  = null,
    string? Developer    = null,
    string? Description  = null);

/// <summary>
/// Shared outcome for both importers. <c>Skipped</c> counts rows that already existed — not a
/// failure, and reported separately so re-running a corrected file reads as "nothing new" rather
/// than as errors.
/// </summary>
public sealed record ImportResult(
    int Created,
    int Skipped,
    int Failed,
    IReadOnlyList<ImportRowProblem> Problems);

/// <summary>A rejected or skipped row: its zero-based index in the submitted list, and why.</summary>
public sealed record ImportRowProblem(int Row, string Message);

public sealed class ImportPropertiesValidator : AbstractValidator<ImportPropertiesCommand>
{
    public const int MaxRows = 2000;

    public ImportPropertiesValidator()
    {
        RuleFor(x => x.Rows).NotNull()
            .Must(r => r.Count > 0).WithMessage("No rows to import.")
            .Must(r => r.Count <= MaxRows)
            .WithMessage($"Too many rows in one request (max {MaxRows}). The importer splits larger files.");
    }
}
