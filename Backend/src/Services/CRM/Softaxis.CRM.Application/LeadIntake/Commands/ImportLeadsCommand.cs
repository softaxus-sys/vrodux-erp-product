using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.CRM.Application.LeadIntake.Commands;

/// <summary>
/// Bulk lead import (POST /api/internal/leads/import). Accepts many canonical rows in one
/// request — used by the Leads-page Excel/CSV importer and the "CSV Import" integration card.
/// Each row flows through the same shared intake pipeline (mapping → dedupe → routing →
/// notification) as every other source, so imports honour duplicate rules and assignment.
/// Tenant is taken from the authenticated context.
/// </summary>
public sealed record ImportLeadsCommand(IReadOnlyList<IngestLeadInput> Leads) : ICommand<ImportLeadsResult>;

/// <summary>Per-import outcome tally plus the row indexes that were rejected (for UI feedback).</summary>
public sealed record ImportLeadsResult(int Created, int Duplicates, int Failed, IReadOnlyList<ImportRowError> Errors);

/// <summary>A single rejected row: its zero-based index in the submitted list and why it failed.</summary>
public sealed record ImportRowError(int Row, string Message);

public sealed class ImportLeadsValidator : AbstractValidator<ImportLeadsCommand>
{
    // Guardrail: a single request should stay a reasonable batch. The importer chunks larger files.
    public const int MaxRows = 5000;

    public ImportLeadsValidator()
    {
        RuleFor(x => x.Leads).NotNull()
            .Must(l => l.Count > 0).WithMessage("No rows to import.")
            .Must(l => l.Count <= MaxRows).WithMessage($"Too many rows in one request (max {MaxRows}). Split the file.");
    }
}
