namespace Softaxis.Seo.Application.Content.Dtos;

public sealed record ArticleDto(
    Guid Id, Guid SiteId, string Title, string Slug, string MetaDescription, string TargetKeyword,
    string BodyMarkdown, int WordCount, string SourceSignalsJson, string Status,
    string? ReviewedByName, DateTime? ReviewedAt, int? WordPressPostId, DateTime? PushedToWordPressAt,
    DateTime CreatedAt);

public sealed record ContentSettingsDto(
    Guid SiteId, bool Enabled, string Frequency, int ArticlesPerRun, int TargetWordCount,
    string? NicheHint, string? CompetitorDomainsCsv, DateTime? NextRunAt, DateTime? LastRunAt);

public sealed record UpdateContentSettingsRequest(
    bool Enabled, string Frequency, int ArticlesPerRun, int TargetWordCount,
    string? NicheHint, string? CompetitorDomainsCsv);

public sealed record GenerateArticleNowResultDto(int ArticlesCreated);

public sealed record WordPressStatusDto(bool Connected, string? SiteUrl, string? Username, string Status, string? LastError, bool AutoPublish);

public sealed record ConnectWordPressRequest(string SiteUrl, string Username, string AppPassword);
