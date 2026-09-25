using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.RealEstate.Application.Listings.Dtos;

namespace Softaxis.RealEstate.Application.Listings.Commands;

/// <summary>
/// The building and the unit in one go.
///
/// <para>Creating a unit used to require the building to exist first, so adding a single apartment
/// meant two trips through two different screens. In practice an agency takes on one listing at a
/// time and the building is whatever the owner calls it.</para>
///
/// <para><see cref="PropertyId"/> reuses a building already on file; leaving it null and naming one
/// in <see cref="PropertyName"/> creates it. Reuse is offered rather than always creating, because
/// six apartments in the same tower are six listings in one building, not six buildings — and
/// duplicating it would split its photographs, its occupancy and its website listing across copies.
/// </para>
/// </summary>
public sealed record CreateListingCommand(
    // ── the building ──
    Guid? PropertyId,
    string? PropertyName,
    string? PropertyType,
    string? Category,
    string? Address,
    string? City,
    string? Emirate,
    string? Developer,
    string? PropertyDescription,
    decimal PropertyMarketValue,

    // ── the unit ──
    /// <summary>Optional: a placeholder is generated when the sheet has no door number.</summary>
    string? UnitNumber,
    string? UnitType,
    decimal Area,
    int Floor,
    decimal RentPerYear,
    decimal SalePrice,
    string? Status,
    string? Furnishing,
    string? View,
    int? Bedrooms,
    int? Bathrooms,
    int Parking,
    decimal ServiceCharge,
    string? Notes,

    // ── the listing ──
    string? Purpose,
    string? ListedOn,
    string? BedsLabel,
    string? PriceLabel,
    string? AreaLabel,
    bool HasMedia,
    bool IsListed,
    string? ListedBy,
    string? AgentName,

    /// <summary>
    /// The system account allowed to see this listing's confidential columns. Optional — when
    /// null, the handler defaults it to whoever is creating the listing (they just supplied the
    /// owner data, so they are the natural first agent); pass an explicit id to hand the listing
    /// straight to someone else instead.
    /// </summary>
    Guid? AgentUserId,
    /// <summary>
    /// True (the normal, compliant default) hides Unit Number and Owner Details from everyone but
    /// the agent above and the tenant admin. False is an explicit opt-out — the "Restrict to
    /// owner/agent only" checkbox on the form, unchecked — that opens those two columns to every
    /// staff member who can already see the listing.
    /// </summary>
    bool RestrictConfidentialDetails,
    string? OwnerName,
    string? OwnerPhone,
    string? OwnerPhoneAlt) : ICommand<ListingDto>;

public sealed class CreateListingValidator : AbstractValidator<CreateListingCommand>
{
    public CreateListingValidator()
    {
        // One or the other. Requiring both would make every listing create a duplicate building;
        // requiring neither would leave a unit with nowhere to sit.
        RuleFor(x => x)
            .Must(x => x.PropertyId.HasValue || !string.IsNullOrWhiteSpace(x.PropertyName))
            .WithMessage("Choose a building, or enter a name to create one.");

        RuleFor(x => x.PropertyName).MaximumLength(200);
        RuleFor(x => x.PropertyType).MaximumLength(50);
        RuleFor(x => x.UnitNumber).MaximumLength(50);
        RuleFor(x => x.UnitType).MaximumLength(50);
        RuleFor(x => x.Area).GreaterThanOrEqualTo(0);
        RuleFor(x => x.RentPerYear).GreaterThanOrEqualTo(0);
        RuleFor(x => x.SalePrice).GreaterThanOrEqualTo(0);
        RuleFor(x => x.ListedOn)
            .Matches(@"^\d{4}-\d{2}-\d{2}$")
            .When(x => !string.IsNullOrWhiteSpace(x.ListedOn))
            .WithMessage("The listing date must be yyyy-MM-dd.");
    }
}

/// <summary>
/// Edits a listing — both halves of it.
///
/// <para>The form shows the building and the unit as one record, so the update has to write both.
/// Sending only the unit would leave a corrected building name silently doing nothing, which is the
/// failure the old two-screen split produced in the first place.</para>
///
/// <para>Renaming the building here renames it for every other unit in it. That is intended — there
/// is one tower, not one per listing — but it is the reason the building fields are optional: a
/// caller that does not know them leaves them null and the building is left alone.</para>
/// </summary>
public sealed record UpdateListingCommand(
    Guid Id,

    // ── the building (null leaves it as it is) ──
    string? PropertyName,
    string? PropertyType,
    string? Category,
    string? Address,
    string? City,
    string? Emirate,
    string? Developer,
    string? PropertyDescription,
    decimal? PropertyMarketValue,

    // ── the unit ──
    string UnitNumber,
    string? UnitType,
    decimal Area,
    int Floor,
    decimal RentPerYear,
    decimal SalePrice,
    string? Status,
    string? Furnishing,
    string? View,
    int? Bedrooms,
    int? Bathrooms,
    int Parking,
    decimal ServiceCharge,
    string? Notes,

    // ── the listing ──
    string? Purpose,
    string? ListedOn,
    string? BedsLabel,
    string? PriceLabel,
    string? AreaLabel,
    bool HasMedia,
    bool IsListed,
    string? ListedBy,
    string? AgentName,

    /// <summary>
    /// Reassigns who may see this listing's confidential columns. Only ever applied when the
    /// caller can already see them — a caller who cannot never gets to change who can, and their
    /// value here is silently ignored rather than trusted. Null explicitly unassigns (falls back
    /// to admin-only visibility); the field the form actually sends never omits it, since it is
    /// always prefilled from the listing's current agent.
    /// </summary>
    Guid? AgentUserId,
    /// <summary>
    /// Reassigns whether this listing's confidentiality lock is on. Same rule as
    /// <see cref="AgentUserId"/> above — silently ignored unless the caller can already see the
    /// current state, never trusted from a caller who could not.
    /// </summary>
    bool RestrictConfidentialDetails,
    string? OwnerName,
    string? OwnerPhone,
    string? OwnerPhoneAlt) : ICommand<ListingDto>;

public sealed class UpdateListingValidator : AbstractValidator<UpdateListingCommand>
{
    public UpdateListingValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.UnitNumber).NotEmpty().WithMessage("Unit number is required.").MaximumLength(50);
        RuleFor(x => x.PropertyName).MaximumLength(200);
        RuleFor(x => x.PropertyType).MaximumLength(50);
        RuleFor(x => x.UnitType).MaximumLength(50);
        RuleFor(x => x.Area).GreaterThanOrEqualTo(0);
        RuleFor(x => x.RentPerYear).GreaterThanOrEqualTo(0);
        RuleFor(x => x.SalePrice).GreaterThanOrEqualTo(0);
        RuleFor(x => x.ListedOn)
            .Matches(@"^\d{4}-\d{2}-\d{2}$")
            .When(x => !string.IsNullOrWhiteSpace(x.ListedOn))
            .WithMessage("The listing date must be yyyy-MM-dd.");
    }
}
