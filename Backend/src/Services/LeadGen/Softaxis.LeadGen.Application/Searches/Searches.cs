using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.LeadGen.Application.Catalog;

namespace Softaxis.LeadGen.Application.Searches;

public sealed record SearchInput(
    string Name, string CountryCode, IReadOnlyList<string> Regions, IReadOnlyList<string>? Areas,
    IReadOnlyList<string> Categories, string? Keywords, int MaxResults);

public sealed record SearchDto(
    Guid Id, string Name, string CountryCode, IReadOnlyList<string> Regions, IReadOnlyList<string> Areas,
    IReadOnlyList<string> Categories, string? Keywords, int MaxResults, string Status, string? Error,
    int FoundCount, int NewCount, int DuplicateCount, int RevealedCount, string? Progress, string? CreatedByName,
    DateTime CreatedAt, DateTime? StartedAt, DateTime? CompletedAt);

/// <summary>What a search would do before it is started: how many provider queries, and the daily allowance left.</summary>
public sealed record SearchEstimateDto(int PlannedQueries, int MaxResults, int SearchesLeftToday, int DiscoveryLeftToday,
    bool ProviderConfigured, IReadOnlyList<string> Warnings);

public sealed record GetSearchesQuery : IQuery<IReadOnlyList<SearchDto>>;
public sealed record GetSearchByIdQuery(Guid Id) : IQuery<SearchDto>;
public sealed record EstimateSearchQuery(SearchInput Input) : IQuery<SearchEstimateDto>;
public sealed record CreateSearchCommand(SearchInput Input) : ICommand<SearchDto>;
public sealed record CancelSearchCommand(Guid Id) : ICommand;
public sealed record DeleteSearchCommand(Guid Id, bool DeleteUnrevealedProspects) : ICommand;

public sealed class SearchInputValidator : AbstractValidator<SearchInput>
{
    public SearchInputValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("Give the search a name.").MaximumLength(120);
        RuleFor(x => x.CountryCode).NotEmpty().Length(2);
        RuleFor(x => x.Regions).NotNull().Must(r => r.Count is >= 1 and <= 7).WithMessage("Choose at least one region.");
        RuleFor(x => x.Categories).NotNull().Must(c => c.Count is >= 1 and <= 8).WithMessage("Choose between 1 and 8 categories.");
        RuleForEach(x => x.Categories).Must(CategoryCatalog.IsValid).WithMessage("Unknown category.");
        RuleFor(x => x.Keywords).MaximumLength(120);
        RuleFor(x => x.MaxResults).InclusiveBetween(10, 1000);
        RuleFor(x => x.Areas).Must(a => a is null || a.Count <= 20).WithMessage("Choose at most 20 areas.");
    }
}

public sealed class CreateSearchValidator : AbstractValidator<CreateSearchCommand>
{
    public CreateSearchValidator() => RuleFor(x => x.Input).SetValidator(new SearchInputValidator());
}

public sealed class EstimateSearchValidator : AbstractValidator<EstimateSearchQuery>
{
    public EstimateSearchValidator() => RuleFor(x => x.Input).SetValidator(new SearchInputValidator());
}
