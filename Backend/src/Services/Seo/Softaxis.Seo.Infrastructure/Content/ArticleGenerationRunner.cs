using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Softaxis.Seo.Domain.Entities;
using Softaxis.Seo.Infrastructure.Persistence;

namespace Softaxis.Seo.Infrastructure.Content;

public interface IArticleGenerationRunner
{
    Task<int> RunAsync(SeoSite site, SeoContentSettings settings, CancellationToken ct);
}

/// <summary>
/// One content-generation run: gather research signals, ask the AI to write articles, store them as
/// pending review. Shared by both "generate now" (GenerateArticleNowHandler) and the scheduled
/// background job (SeoContentBackgroundService) — mirrors SiteScanRunner's own split.
/// </summary>
public sealed class ArticleGenerationRunner(SeoDbContext db, ContentResearch research, IArticleWriter writer, ILogger<ArticleGenerationRunner> logger)
    : IArticleGenerationRunner
{
    public async Task<int> RunAsync(SeoSite site, SeoContentSettings settings, CancellationToken ct)
    {
        try
        {
            var researched = await research.GatherAsync(db, site, settings, ct);
            var written = await writer.WriteAsync(
                site.Domain, settings.NicheHint, researched.OwnPageTitles, researched.Signals,
                settings.ArticlesPerRun, settings.TargetWordCount, ct);

            if (written.Count == 0) return 0;

            var signalsJson = JsonSerializer.Serialize(researched.Signals.Select(s => new { s.Kind, s.Detail }));
            var articles = written.Select(w => new SeoArticle(site.Id, w.Title, w.Slug, w.MetaDescription, w.TargetKeyword, w.BodyMarkdown, signalsJson)).ToList();
            db.Articles.AddRange(articles);
            await db.SaveChangesAsync(ct);

            return articles.Count;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "SEO content generation failed for site {Site}.", site.Id);
            throw;
        }
    }
}
