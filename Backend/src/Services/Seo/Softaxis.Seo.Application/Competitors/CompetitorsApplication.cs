using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Seo.Application.Competitors;

public sealed record CompetitorDto(Guid Id, string Domain, DateTime CreatedAt);

/// <summary>A search market the keyword data can be bought for.</summary>
public sealed record LocationOptionDto(int Code, string Name);

public sealed record ScanSummaryDto(
    Guid Id, string Status, DateTime CreatedAt, DateTime? CompletedAt, int PagesCrawled, int CreditsCharged, bool KeywordDataUsed,
    string? KeywordDataNote, string? Error, int TopicGapCount, int KeywordGapCount, int LocationCode);

/// <param name="EstimatedCredits">The most one comparison can cost right now (pages read + keyword lists that must be bought fresh).</param>
public sealed record CompetitorsOverviewDto(
    Guid SiteId, IReadOnlyList<CompetitorDto> Competitors, int Max, bool KeywordDataAvailable, int EstimatedCredits, int PagesPerDomain,
    int CreditsPerCompetitorKeywords, long Balance, ScanSummaryDto? LatestScan, IReadOnlyList<LocationOptionDto> Locations);

/// <summary>A subject several competitors write about and this site does not.</summary>
public sealed record TopicGapDto(string Phrase, int Pages, int Competitors, string ExampleTitle, string ExampleUrl);

/// <summary>A search term competitors rank for and this site does not rank for at all.</summary>
public sealed record KeywordGapDto(string Keyword, int Volume, int? Difficulty, string Competitor, int Position, int CompetitorCount);

public sealed record PlanItemDto(
    Guid Id, string PlannedDate, string Title, string TargetKeyword, string Reason, int? SearchVolume, int? Difficulty,
    string Source, string Status, Guid? ArticleId);

public sealed record ScanDetailDto(
    ScanSummaryDto Summary, IReadOnlyList<string> Competitors, IReadOnlyList<TopicGapDto> TopicGaps,
    IReadOnlyList<KeywordGapDto> KeywordGaps, IReadOnlyList<PlanItemDto> Plan);

public sealed record GetCompetitorsQuery(Guid SiteId) : IQuery<CompetitorsOverviewDto>;
public sealed record GetCompetitorScanQuery(Guid ScanId) : IQuery<ScanDetailDto>;
public sealed record GetCompetitorScansQuery(Guid SiteId) : IQuery<IReadOnlyList<ScanSummaryDto>>;

public sealed record AddCompetitorCommand(Guid SiteId, string Domain) : ICommand<CompetitorDto>;

public sealed class AddCompetitorValidator : AbstractValidator<AddCompetitorCommand>
{
    public AddCompetitorValidator()
    {
        RuleFor(x => x.Domain).NotEmpty().WithMessage("Enter the competitor's website, such as example.com.").MaximumLength(255);
    }
}

public sealed record RemoveCompetitorCommand(Guid Id) : ICommand;

/// <summary>Starts a comparison. It runs in the background; the result is read from the scan.</summary>
public sealed record StartCompetitorScanCommand(Guid SiteId, int? LocationCode) : ICommand<ScanSummaryDto>;

/// <summary>Writes the article for one calendar slot as a draft for review. Nothing is published.</summary>
public sealed record DraftPlanItemCommand(Guid Id) : ICommand<PlanItemDto>;

public sealed record SkipPlanItemCommand(Guid Id) : ICommand<PlanItemDto>;
