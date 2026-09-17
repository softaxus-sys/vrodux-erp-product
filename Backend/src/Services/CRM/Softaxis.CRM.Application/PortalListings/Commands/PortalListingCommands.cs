using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.CRM.Application.PortalListings.Dtos;

namespace Softaxis.CRM.Application.PortalListings.Commands;

public static class PortalListingPortals
{
    /// <summary>Provider keys a listing can belong to — the same keys the lead integrations use.</summary>
    public static readonly string[] All = ["bayut", "property-finder", "dubizzle"];
}

/// <summary>
/// Registers a listing. <paramref name="Reference"/> and <paramref name="Url"/> are both optional but
/// at least one must identify the listing; a URL is stored along with the numeric id read out of it.
/// <paramref name="AgentUserId"/> defaults to the caller — only admins and team leads may register a
/// listing for somebody else.
/// </summary>
public sealed record CreatePortalListingCommand(
    string Portal, string? Reference, string? Url, string? Title,
    Guid? AgentUserId = null, Guid? TeamId = null) : ICommand<PortalListingDto>;

public sealed class CreatePortalListingValidator : AbstractValidator<CreatePortalListingCommand>
{
    public CreatePortalListingValidator()
    {
        RuleFor(x => x.Portal).Must(p => PortalListingPortals.All.Contains(p))
            .WithMessage("Choose a supported portal.");
        RuleFor(x => x).Must(x => !string.IsNullOrWhiteSpace(x.Reference) || !string.IsNullOrWhiteSpace(x.Url))
            .WithMessage("Enter the listing reference or the listing URL.");
        RuleFor(x => x.Reference).MaximumLength(500);
        RuleFor(x => x.Url).MaximumLength(500);
        RuleFor(x => x.Title).MaximumLength(200);
    }
}

public sealed record UpdatePortalListingCommand(
    Guid Id, string? Reference, string? Url, string? Title,
    Guid AgentUserId, Guid? TeamId, bool IsActive) : ICommand<PortalListingDto>;

public sealed class UpdatePortalListingValidator : AbstractValidator<UpdatePortalListingCommand>
{
    public UpdatePortalListingValidator()
    {
        RuleFor(x => x.AgentUserId).NotEmpty();
        RuleFor(x => x).Must(x => !string.IsNullOrWhiteSpace(x.Reference) || !string.IsNullOrWhiteSpace(x.Url))
            .WithMessage("Enter the listing reference or the listing URL.");
        RuleFor(x => x.Reference).MaximumLength(500);
        RuleFor(x => x.Url).MaximumLength(500);
        RuleFor(x => x.Title).MaximumLength(200);
    }
}

public sealed record DeletePortalListingCommand(Guid Id) : ICommand;

/// <summary>One row of a historical-listings file. <paramref name="Agent"/> is an email or full name; blank = the caller.</summary>
public sealed record ImportPortalListingRow(string? Reference, string? Url, string? Title, string? Agent, string? Portal);

/// <summary>
/// Bulk registration of listings published before Vrodux (an export from Profolio / the portal / a
/// spreadsheet). Each row is validated and permission-checked on its own; a bad row is reported and
/// skipped, never failing the whole file.
/// </summary>
public sealed record ImportPortalListingsCommand(string Portal, IReadOnlyList<ImportPortalListingRow> Rows)
    : ICommand<ImportPortalListingsResultDto>;

public sealed class ImportPortalListingsValidator : AbstractValidator<ImportPortalListingsCommand>
{
    public const int MaxRows = 5000;

    public ImportPortalListingsValidator()
    {
        RuleFor(x => x.Portal).Must(p => PortalListingPortals.All.Contains(p)).WithMessage("Choose a supported portal.");
        RuleFor(x => x.Rows).NotEmpty().WithMessage("The file has no rows.")
            .Must(r => r.Count <= MaxRows).WithMessage($"Import at most {MaxRows} listings at a time.");
    }
}

public sealed record ImportPortalListingRowError(int Row, string? Listing, string Reason);

public sealed record ImportPortalListingsResultDto(int Created, int Skipped, IReadOnlyList<ImportPortalListingRowError> Errors);
