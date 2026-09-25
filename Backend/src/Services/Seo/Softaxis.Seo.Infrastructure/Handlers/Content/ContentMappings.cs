using Softaxis.Seo.Application.Content.Dtos;
using Softaxis.Seo.Domain.Entities;

namespace Softaxis.Seo.Infrastructure.Handlers.Content;

internal static class ContentMappings
{
    public static ArticleDto ToDto(this SeoArticle a) => new(
        a.Id, a.SiteId, a.Title, a.Slug, a.MetaDescription, a.TargetKeyword, a.BodyMarkdown, a.WordCount,
        a.SourceSignalsJson, a.Status, a.ReviewedByName, a.ReviewedAt, a.WordPressPostId, a.PushedToWordPressAt, a.CreatedAt);

    public static ContentSettingsDto ToDto(this SeoContentSettings s) => new(
        s.SiteId, s.Enabled, s.Frequency, s.ArticlesPerRun, s.TargetWordCount, s.NicheHint, s.CompetitorDomainsCsv, s.NextRunAt, s.LastRunAt);

    public static WordPressStatusDto ToDto(this SeoWordPressConnection? c) => c is null
        ? new WordPressStatusDto(false, null, null, "disconnected", null, false)
        : new WordPressStatusDto(true, c.SiteUrl, c.Username, c.Status, c.LastError, c.AutoPublish);
}
