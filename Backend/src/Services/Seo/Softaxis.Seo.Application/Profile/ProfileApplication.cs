using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Seo.Application.Profile;

/// <param name="Exists">A profile has been saved for this site.</param>
/// <param name="Ready">There is enough to steer content: a saved, complete profile, or (for older sites) a long-enough "about this site" note.</param>
/// <param name="UsingNicheHint">Ready only because of the older free-text "what is this site about" note.</param>
public sealed record BusinessProfileDto(
    Guid SiteId, bool Exists, bool Ready, bool UsingNicheHint, string BusinessName, string Industry, string Summary,
    IReadOnlyList<string> Offers, string Audience, string ServiceAreas, IReadOnlyList<string> AvoidTopics, string Source,
    DateTime? ImportedFromTenantAt, DateTime? UpdatedAt,
    bool IsDraft = false, string AutofillStatus = "none", string? AutofillNote = null);

public sealed record TenantProfilePreviewDto(
    bool Enough, IReadOnlyList<string> Missing, IReadOnlyList<string> NotInWorkspace,
    string? BusinessName, string? Industry, string? Country, string? Website, string? SiteDomain, bool? WebsiteMatches,
    string ProposedSummary, string ProposedServiceAreas);

public sealed record BusinessProfileDraftDto(string? Industry, string Summary, IReadOnlyList<string> Offers, string Audience, string ServiceAreas, int PagesRead);

public sealed record SuggestedCompetitorDto(string Domain, int SharedKeywords, int? AveragePosition);
public sealed record SuggestedCompetitorsDto(IReadOnlyList<SuggestedCompetitorDto> Suggestions, int CreditsCharged, string? Note);

public sealed record GetBusinessProfileQuery(Guid SiteId) : IQuery<BusinessProfileDto>;
public sealed record GetTenantProfilePreviewQuery(Guid SiteId) : IQuery<TenantProfilePreviewDto>;

public sealed record SaveBusinessProfileCommand(
    Guid SiteId, string BusinessName, string? Industry, string Summary, IReadOnlyList<string>? Offers, string? Audience,
    string? ServiceAreas, IReadOnlyList<string>? AvoidTopics, string? Source = null) : ICommand<BusinessProfileDto>;

public sealed class SaveBusinessProfileValidator : AbstractValidator<SaveBusinessProfileCommand>
{
    public SaveBusinessProfileValidator()
    {
        RuleFor(x => x.BusinessName).NotEmpty().WithMessage("Enter the business name.").MaximumLength(200);
        RuleFor(x => x.Summary).NotEmpty().WithMessage("Describe what the business does.")
            .MinimumLength(20).WithMessage("Describe what the business does in at least a sentence.").MaximumLength(1500);
        RuleFor(x => x.Industry).MaximumLength(120);
        RuleFor(x => x.Audience).MaximumLength(500);
        RuleFor(x => x.ServiceAreas).MaximumLength(300);
        RuleFor(x => x).Must(x => (x.Offers?.Count(o => !string.IsNullOrWhiteSpace(o)) ?? 0) > 0 || !string.IsNullOrWhiteSpace(x.Industry))
            .WithMessage("Add what you sell, or the industry you are in.");
    }
}

/// <summary>Copies the workspace's own company details into this site's profile.</summary>
public sealed record ImportBusinessProfileFromTenantCommand(Guid SiteId, bool Overwrite) : ICommand<BusinessProfileDto>;

/// <summary>Reads the site's own pages and proposes a profile. Nothing is saved; a person reviews and saves it.</summary>
public sealed record DraftBusinessProfileFromSiteCommand(Guid SiteId) : ICommand<BusinessProfileDraftDto>;

/// <summary>
/// Reads the website and the workspace's company details in the background and saves what it finds as a DRAFT the person then confirms.
/// Runs by itself when a website is connected; this command is for sites connected before that existed, or to try again.
/// </summary>
public sealed record RequestProfileAutofillCommand(Guid SiteId) : ICommand<BusinessProfileDto>;

/// <summary>Finds websites that rank for the same searches as this one. Uses credits.</summary>
public sealed record SuggestCompetitorsCommand(Guid SiteId, int? LocationCode) : ICommand<SuggestedCompetitorsDto>;
