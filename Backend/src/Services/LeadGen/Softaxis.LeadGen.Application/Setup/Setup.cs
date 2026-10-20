using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.LeadGen.Application.Setup;

// ── Meta: everything the screens need to render pickers and explain limits ───────────────────

public sealed record RegionDto(string Name, string NameAr, IReadOnlyList<string> Areas);
public sealed record CountryDto(string Code, string Name, string NameAr, bool Live, bool Allowed, string ComplianceNote,
    string Timezone, IReadOnlyList<string> WorkingDays, IReadOnlyList<RegionDto> Regions);
public sealed record CategoryDto(string Key, string Label, string LabelAr, string Group);

public sealed record LimitsDto(
    int RevealCost, int VerifiedEmailBonus, int MaxResultsPerSearch, int MaxRevealsPerRequest,
    int DailySearchLimit, int SearchesToday, int DailyDiscoveryLimit, int DiscoveredToday,
    int MaxMailboxes, int MaxDailySendsPerMailbox, int MaxDailySendsPerWorkspace, int SentToday, int BounceRefundDays);

public sealed record MetaDto(
    bool Enabled, bool ProviderConfigured, bool EmailVerifierConfigured, string DefaultCountry,
    IReadOnlyList<CountryDto> Countries, IReadOnlyList<CategoryDto> Categories, LimitsDto Limits,
    long Balance, bool CanSend, string? SendBlockReason, bool SenderIdentityReady);

public sealed record GetMetaQuery : IQuery<MetaDto>;

// ── Targeting profile ────────────────────────────────────────────────────────────────────────

public sealed record ProfileDto(
    string? OfferSummary, string? TargetCustomers, string? DealSize, string CountryCode,
    IReadOnlyList<string> PreferredRegions, IReadOnlyList<string> PreferredCategories, string? ExcludeKeywords,
    string? SenderBusinessName, string? SenderAddress, string? SenderWebsite);

public sealed record ProfileInput(
    string? OfferSummary, string? TargetCustomers, string? DealSize, string CountryCode,
    IReadOnlyList<string>? PreferredRegions, IReadOnlyList<string>? PreferredCategories, string? ExcludeKeywords,
    string? SenderBusinessName, string? SenderAddress, string? SenderWebsite);

public sealed record GetProfileQuery : IQuery<ProfileDto>;
public sealed record UpdateProfileCommand(ProfileInput Input) : ICommand<ProfileDto>;

public sealed class UpdateProfileValidator : AbstractValidator<UpdateProfileCommand>
{
    public UpdateProfileValidator()
    {
        RuleFor(x => x.Input.OfferSummary).MaximumLength(600);
        RuleFor(x => x.Input.TargetCustomers).MaximumLength(600);
        RuleFor(x => x.Input.DealSize).MaximumLength(100);
        RuleFor(x => x.Input.ExcludeKeywords).MaximumLength(300);
        RuleFor(x => x.Input.SenderBusinessName).MaximumLength(160);
        RuleFor(x => x.Input.SenderAddress).MaximumLength(300);
        RuleFor(x => x.Input.SenderWebsite).MaximumLength(200);
        RuleFor(x => x.Input.CountryCode).NotEmpty().Length(2);
        RuleForEach(x => x.Input.PreferredCategories).Must(k => Catalog.CategoryCatalog.IsValid(k))
            .WithMessage("Unknown category.").When(x => x.Input.PreferredCategories is not null);
    }
}

// ── Suppression (do not contact) ─────────────────────────────────────────────────────────────

public sealed record SuppressionDto(Guid Id, string Kind, string Value, string Reason, string? Source, DateTime CreatedAt);

public sealed record GetSuppressionQuery(string? Search = null, int Page = 1, int PageSize = 50)
    : IQuery<PagedResult<SuppressionDto>>;
public sealed record AddSuppressionCommand(string Kind, string Value, string? Reason) : ICommand<SuppressionDto>;
public sealed record RemoveSuppressionCommand(Guid Id) : ICommand;
/// <summary>Bulk add from a pasted list or a file. Anything with an "@" is an email, anything else a domain.</summary>
public sealed record ImportSuppressionCommand(IReadOnlyList<string> Values) : ICommand<ImportSuppressionResult>;
public sealed record ImportSuppressionResult(int Added, int Skipped);

public sealed class AddSuppressionValidator : AbstractValidator<AddSuppressionCommand>
{
    public AddSuppressionValidator()
    {
        RuleFor(x => x.Kind).Must(k => Domain.Entities.SuppressionKind.All.Contains(k)).WithMessage("Choose email, domain or phone.");
        RuleFor(x => x.Value).NotEmpty().MaximumLength(320);
    }
}

public sealed class ImportSuppressionValidator : AbstractValidator<ImportSuppressionCommand>
{
    public ImportSuppressionValidator() =>
        RuleFor(x => x.Values).NotNull().Must(v => v.Count is > 0 and <= 20000).WithMessage("Provide between 1 and 20,000 entries.");
}
