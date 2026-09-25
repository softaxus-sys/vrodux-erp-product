using System.Text.Json;
using Softaxis.AiAssistant.Application.Abstractions;

namespace Softaxis.Seo.Infrastructure.Content;

/// <summary>Writes full SEO articles via IAiCompletionService — the tenant's own configured model,
/// same reuse as SeoAiAnalyzer. One completion call regardless of how many articles are requested.</summary>
public sealed class ArticleWriter(IAiCompletionService completion) : IArticleWriter
{
    private const string SystemPromptTemplate = """
        You are an SEO content writer for the website "{0}". Write {1} complete, original, publish-ready
        SEO article(s) in Markdown, each targeting one keyword opportunity. Use the research signals given
        to you to choose real, relevant topics — prefer a topic backed by a "gsc_query" or "competitor_topic"
        signal over inventing one from nothing. NEVER propose a topic that duplicates one of the site's
        existing page titles (given to you) almost verbatim.

        Never invent specific facts about the business itself (address, phone number, prices, founding date,
        staff names, certifications) that were not given to you — write general, helpful, accurate content
        on the topic instead. Aim for approximately {2} words per article, a clear H1-equivalent opening,
        subheadings, and a natural (not stuffed) use of the target keyword.

        Respond with ONLY a JSON array, no prose, no markdown fences. Each element:
        {{
          "title": "<article title, <= 60 characters where possible>",
          "slug": "<url-safe-slug-like-this>",
          "metaDescription": "<<= 155 characters>",
          "targetKeyword": "<the primary keyword this article targets>",
          "bodyMarkdown": "<the full article body in Markdown, including headings>"
        }}
        """;

    public async Task<IReadOnlyList<WrittenArticle>> WriteAsync(
        string domain, string? nicheHint, IReadOnlyList<string> ownPageTitles,
        IReadOnlyList<ResearchSignal> signals, int count, int targetWordCount, CancellationToken ct)
    {
        var systemPrompt = string.Format(SystemPromptTemplate, domain, count, targetWordCount);

        var userPrompt = JsonSerializer.Serialize(new
        {
            nicheHint = string.IsNullOrWhiteSpace(nicheHint) ? null : nicheHint,
            existingPageTitles = ownPageTitles.Take(30),
            researchSignals = signals.Select(s => new { s.Kind, s.Detail }),
            note = signals.Count == 0
                ? "No research signals are available yet for this site (connect Google Search Console, or name a competitor, for better topic targeting). Base the topic on the niche hint and general knowledge of the site's apparent industry from its existing pages."
                : (string?)null,
        });

        string raw;
        try { raw = await completion.CompleteAsync(systemPrompt, userPrompt, ct); }
        catch { return []; } // AI not configured, or the call failed — caller records zero articles this run

        return Parse(raw);
    }

    private static List<WrittenArticle> Parse(string raw)
    {
        var result = new List<WrittenArticle>();
        try
        {
            using var doc = JsonDocument.Parse(ExtractJsonArray(raw));
            foreach (var el in doc.RootElement.EnumerateArray())
            {
                if (!el.TryGetProperty("title", out var title) || string.IsNullOrWhiteSpace(title.GetString())) continue;
                if (!el.TryGetProperty("bodyMarkdown", out var body) || string.IsNullOrWhiteSpace(body.GetString())) continue;

                var slug = el.TryGetProperty("slug", out var s) ? s.GetString() ?? "" : "";
                if (string.IsNullOrWhiteSpace(slug)) slug = Slugify(title.GetString()!);

                result.Add(new WrittenArticle(
                    title.GetString()!,
                    slug,
                    el.TryGetProperty("metaDescription", out var m) ? m.GetString() ?? "" : "",
                    el.TryGetProperty("targetKeyword", out var k) ? k.GetString() ?? "" : "",
                    body.GetString()!));
            }
        }
        catch
        {
            // Malformed AI output — this run simply produces zero articles rather than a bad one.
        }
        return result;
    }

    private static string Slugify(string title)
    {
        var cleaned = new string(title.ToLowerInvariant().Select(c => char.IsLetterOrDigit(c) ? c : ' ').ToArray());
        return string.Join('-', cleaned.Split(' ', StringSplitOptions.RemoveEmptyEntries));
    }

    /// <summary>Models sometimes wrap JSON in markdown fences despite instructions — strip them.</summary>
    private static string ExtractJsonArray(string raw)
    {
        var s = raw.Trim();
        var start = s.IndexOf('[');
        var end = s.LastIndexOf(']');
        return start >= 0 && end > start ? s[start..(end + 1)] : s;
    }
}
