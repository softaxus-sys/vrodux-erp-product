using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Softaxis.Seo.Domain.Entities;
using Softaxis.Seo.Infrastructure.Persistence;
using Softaxis.Seo.Infrastructure.Profile;

namespace Softaxis.Seo.Infrastructure.Content;

public interface IArticleGenerationRunner
{
    /// <summary>Returns how many articles were drafted. Returns 0 without writing anything when the site has no usable business profile.</summary>
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
            // Without knowing what the business does, the AI can only guess a topic from page titles — that is how off-topic articles happen.
            var business = await BusinessContextLoader.LoadAsync(db, site, ct);
            if (business is null)
            {
                logger.LogInformation("Skipped content run for site {Site}: no business profile yet.", site.Id);
                return 0;
            }

            var researched = await research.GatherAsync(db, site, settings, ct);

            // Competitor pages the business has said it never writes about are not worth passing on.
            var vocab = RelevanceFilter.Vocabulary(business);
            var signals = researched.Signals
                .Where(s => s.Kind != "competitor_topic" || RelevanceFilter.Classify(s.Detail, business, vocab) != Fit.Avoid)
                .ToList();

            var written = await writer.WriteAsync(
                site.Domain, settings.NicheHint, researched.OwnPageTitles, signals,
                settings.ArticlesPerRun, settings.TargetWordCount, business, ct);

            if (written.Count == 0) return 0;

            var signalsJson = JsonSerializer.Serialize(signals.Select(s => new { s.Kind, s.Detail }));
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
