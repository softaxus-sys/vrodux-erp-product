using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Seo.Application.Catalogue;

/// <param name="Problems">Rule codes, e.g. "title.missing" — the screen supplies the wording.</param>
public sealed record CatalogueSeoItemDto(
    Guid Id, string Name, string Slug, string CategoryName, bool PublishedOnline, string? SeoTitle, string? MetaDescription,
    int DescriptionWords, int ImageCount, int ImagesMissingAlt, int Score, IReadOnlyList<string> Problems);

public sealed record CatalogueSeoDto(int Total, int WithProblems, int AverageScore, IReadOnlyList<CatalogueSeoItemDto> Items);

public sealed record CatalogueSuggestionDto(Guid Id, string SeoTitle, string MetaDescription, string? Note);

public sealed record GetCatalogueSeoQuery : IQuery<CatalogueSeoDto>;

/// <summary>Asks the workspace's AI for a search title and meta description. Nothing is saved.</summary>
public sealed record SuggestCatalogueSeoCommand(Guid Id) : ICommand<CatalogueSuggestionDto>;

/// <summary>Saves a title / description to the Inventory listing itself, so the storefront, Shopify and Google all read the same text.</summary>
public sealed record ApplyCatalogueSeoCommand(Guid Id, string? SeoTitle, string? MetaDescription) : ICommand<CatalogueSeoItemDto>;

public sealed class ApplyCatalogueSeoValidator : AbstractValidator<ApplyCatalogueSeoCommand>
{
    public ApplyCatalogueSeoValidator()
    {
        RuleFor(x => x.SeoTitle).MaximumLength(70).WithMessage("The search title is too long (70 characters at most).");
        RuleFor(x => x.MetaDescription).MaximumLength(320).WithMessage("The meta description is too long (320 characters at most).");
        RuleFor(x => x).Must(x => !string.IsNullOrWhiteSpace(x.SeoTitle) || !string.IsNullOrWhiteSpace(x.MetaDescription)).WithMessage("Nothing to save.");
    }
}
