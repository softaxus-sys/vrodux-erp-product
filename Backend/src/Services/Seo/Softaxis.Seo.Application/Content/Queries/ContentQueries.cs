using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Seo.Application.Content.Dtos;

namespace Softaxis.Seo.Application.Content.Queries;

public sealed record GetContentSettingsQuery(Guid SiteId) : IQuery<ContentSettingsDto>;
public sealed record GetArticlesQuery(Guid SiteId, string? Status) : IQuery<IReadOnlyList<ArticleDto>>;
public sealed record GetArticleByIdQuery(Guid Id) : IQuery<ArticleDto>;
public sealed record GetWordPressStatusQuery(Guid SiteId) : IQuery<WordPressStatusDto>;
