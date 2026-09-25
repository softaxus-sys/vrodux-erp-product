namespace Softaxis.Seo.Infrastructure.Content;

public sealed record WrittenArticle(string Title, string Slug, string MetaDescription, string TargetKeyword, string BodyMarkdown);

public interface IArticleWriter
{
    /// <summary>Writes up to <paramref name="count"/> articles in one completion call — a batch of
    /// requests to the same model is one call, same reasoning as SeoAiAnalyzer batching issues.
    /// Returns fewer than requested if the model's response can't be fully parsed; never throws for
    /// a partial/malformed response.</summary>
    Task<IReadOnlyList<WrittenArticle>> WriteAsync(
        string domain, string? nicheHint, IReadOnlyList<string> ownPageTitles,
        IReadOnlyList<ResearchSignal> signals, int count, int targetWordCount, CancellationToken ct);
}
