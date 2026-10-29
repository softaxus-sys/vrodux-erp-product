using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Inventory.Application.ProductTemplates;

/// <summary>What the SEO module needs to judge one online listing: its search text, its words and its photos.</summary>
public sealed record CatalogueSeoRowDto(
    Guid    Id,
    string  Name,
    string  Slug,
    string  CategoryName,
    string? BrandName,
    bool    PublishedOnline,
    string? SeoTitle,
    string? MetaDescription,
    string? ShortDescription,
    /// <summary>The description with markup removed, cut to 800 characters — enough for the AI to write from.</summary>
    string  DescriptionExcerpt,
    int     DescriptionWords,
    int     ImageCount,
    int     ImagesMissingAlt);

public sealed record GetCatalogueSeoQuery(int Limit = 500) : IQuery<IReadOnlyList<CatalogueSeoRowDto>>;

/// <summary>Sets only the search title and meta description of a listing — nothing else about it changes.</summary>
public sealed record SetTemplateSeoCommand(Guid TemplateId, string? SeoTitle, string? MetaDescription) : ICommand<CatalogueSeoRowDto>;

public sealed class SetTemplateSeoValidator : AbstractValidator<SetTemplateSeoCommand>
{
    public SetTemplateSeoValidator()
    {
        RuleFor(x => x.SeoTitle).MaximumLength(70).WithMessage("The search title is too long (70 characters at most).");
        RuleFor(x => x.MetaDescription).MaximumLength(320).WithMessage("The meta description is too long (320 characters at most).");
        RuleFor(x => x).Must(x => !string.IsNullOrWhiteSpace(x.SeoTitle) || !string.IsNullOrWhiteSpace(x.MetaDescription)).WithMessage("Nothing to save.");
    }
}
