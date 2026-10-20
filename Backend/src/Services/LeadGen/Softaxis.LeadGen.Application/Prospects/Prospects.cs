using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.LeadGen.Domain.Entities;

namespace Softaxis.LeadGen.Application.Prospects;

public sealed record ContactDto(Guid Id, string FullName, string? Title, string? Email, string EmailStatus, string? Phone, string Source);

/// <summary>
/// A prospect as the API shows it. Until it is revealed, Phone / Website / Email are always null —
/// the teaser flags say what exists, never what it is. That is enforced when the DTO is built, not
/// left to the screen.
/// </summary>
public sealed record ProspectDto(
    Guid Id, Guid? SearchJobId, string Name, string? Category, string? CategoryLabel, string CountryCode,
    string? Region, string? City, string? Area, string? Address, decimal? Rating, int? ReviewCount,
    string? BusinessStatus, string? GoogleMapsUri,
    bool IsRevealed, string Status, int QualityScore, int FitScore, IReadOnlyList<string> ScoreNotes,
    bool HasPhone, bool HasWebsite, bool? HasEmail,
    string? Phone, string? PhoneType, string? Website, string? Email, string EmailStatus, bool EmailIsRole,
    IReadOnlyDictionary<string, string>? Social,
    Guid? OwnerUserId, string? OwnerName, Guid? CrmLeadId, string? Notes, bool Suppressed,
    DateTime? RevealedAt, DateTime? LastVerifiedAt, DateTime CreatedAt, IReadOnlyList<ContactDto>? Contacts);

public sealed record ProspectFilter(
    string? Search = null, Guid? SearchJobId = null, string? Status = null, bool? Revealed = null,
    int? MinQuality = null, int? MinFit = null, string? Region = null, string? Category = null,
    bool? HasEmail = null, Guid? OwnerUserId = null, bool? InCrm = null, string? Sort = "fit");

public sealed record GetProspectsQuery(ProspectFilter Filter, int Page = 1, int PageSize = 50)
    : IQuery<PagedResult<ProspectDto>>;

public sealed record ProspectStatsDto(int Total, int Discovered, int Revealed, int Contacted, int Replied, int Qualified,
    int Converted, int Rejected, int DoNotContact, int InCrm);

public sealed record GetProspectStatsQuery(Guid? SearchJobId = null) : IQuery<ProspectStatsDto>;
public sealed record GetProspectByIdQuery(Guid Id) : IQuery<ProspectDto>;

// ── Reveal: where the credits are spent ──────────────────────────────────────────────────────

public sealed record RevealItemDto(Guid Id, string Outcome, int Credits, string? Message);

public sealed record RevealResultDto(
    int Revealed, int Refunded, int Skipped, int CreditsSpent, long Balance, IReadOnlyList<RevealItemDto> Items);

public sealed record RevealProspectsCommand(IReadOnlyList<Guid> Ids) : ICommand<RevealResultDto>;

// ── Editing ──────────────────────────────────────────────────────────────────────────────────

public sealed record UpdateProspectCommand(Guid Id, string? Status, string? Notes, Guid? OwnerUserId,
    string? OwnerName, bool ClearOwner) : ICommand<ProspectDto>;

public sealed record BulkProspectsCommand(IReadOnlyList<Guid> Ids, string Action, string? Status,
    Guid? OwnerUserId, string? OwnerName) : ICommand<BulkResultDto>;

public sealed record BulkResultDto(int Affected, int Skipped);

public sealed record CreateProspectInput(
    string Name, string? Category, string CountryCode, string? Region, string? City, string? Address,
    string? Phone, string? Email, string? Website, string? Notes);

public sealed record CreateProspectCommand(CreateProspectInput Input) : ICommand<ProspectDto>;

public sealed record AddContactCommand(Guid ProspectId, string FullName, string? Title, string? Email, string? Phone)
    : ICommand<ContactDto>;
public sealed record DeleteContactCommand(Guid ProspectId, Guid ContactId) : ICommand;

// ── CRM hand-off ─────────────────────────────────────────────────────────────────────────────

public sealed record ImportToCrmResult(int Created, int Duplicates, int Failed, int NotRevealed,
    IReadOnlyList<string> Errors);

public sealed record ImportToCrmCommand(IReadOnlyList<Guid> Ids) : ICommand<ImportToCrmResult>;

public sealed class RevealValidator : AbstractValidator<RevealProspectsCommand>
{
    public RevealValidator() => RuleFor(x => x.Ids).NotNull().Must(i => i.Count is >= 1 and <= 200)
        .WithMessage("Select between 1 and 200 prospects.");
}

public sealed class BulkValidator : AbstractValidator<BulkProspectsCommand>
{
    public static readonly string[] Actions = ["delete", "assign", "status"];

    public BulkValidator()
    {
        RuleFor(x => x.Ids).NotNull().Must(i => i.Count is >= 1 and <= 1000).WithMessage("Select between 1 and 1,000 prospects.");
        RuleFor(x => x.Action).Must(a => Actions.Contains(a)).WithMessage("Unknown action.");
        RuleFor(x => x.Status).Must(s => s is not null && ProspectStatus.Manual.Contains(s))
            .When(x => x.Action == "status").WithMessage("Choose a valid status.");
    }
}

public sealed class UpdateProspectValidator : AbstractValidator<UpdateProspectCommand>
{
    public UpdateProspectValidator()
    {
        RuleFor(x => x.Status).Must(s => ProspectStatus.Manual.Contains(s!)).When(x => x.Status is not null)
            .WithMessage("Choose a valid status.");
        RuleFor(x => x.Notes).MaximumLength(4000);
    }
}

public sealed class CreateProspectValidator : AbstractValidator<CreateProspectCommand>
{
    public CreateProspectValidator()
    {
        RuleFor(x => x.Input.Name).NotEmpty().WithMessage("Business name is required.").MaximumLength(200);
        RuleFor(x => x.Input.Email).EmailAddress().When(x => !string.IsNullOrWhiteSpace(x.Input.Email))
            .WithMessage("Enter a valid email address.").MaximumLength(320);
        RuleFor(x => x.Input.Phone).MaximumLength(40);
        RuleFor(x => x.Input.Website).MaximumLength(300);
        RuleFor(x => x.Input.CountryCode).NotEmpty().Length(2);
        RuleFor(x => x.Input).Must(i => !string.IsNullOrWhiteSpace(i.Email) || !string.IsNullOrWhiteSpace(i.Phone) || !string.IsNullOrWhiteSpace(i.Website))
            .WithMessage("Add at least a phone, email or website so the prospect can be reached.");
    }
}

public sealed class AddContactValidator : AbstractValidator<AddContactCommand>
{
    public AddContactValidator()
    {
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Email).EmailAddress().When(x => !string.IsNullOrWhiteSpace(x.Email)).MaximumLength(320);
    }
}

public sealed class ImportToCrmValidator : AbstractValidator<ImportToCrmCommand>
{
    public ImportToCrmValidator() => RuleFor(x => x.Ids).NotNull().Must(i => i.Count is >= 1 and <= 500)
        .WithMessage("Select between 1 and 500 prospects.");
}
