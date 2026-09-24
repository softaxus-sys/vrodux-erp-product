using System.Text.Json;
using Softaxis.AiAssistant.Application.Abstractions;

namespace Softaxis.Seo.Infrastructure.Ai;

/// <summary>
/// Batches a scan's new issues into one structured completion via <see cref="IAiCompletionService"/>
/// — the tenant's own configured model, "what's set inside the model" per the product brief — asking
/// for one concrete fix per issue. A malformed/partial AI response drops only the unparseable entries
/// rather than failing the whole scan: a scan that surfaces issues with no proposed fix yet is still
/// useful; one that crashes on a bad AI response is not.
/// </summary>
public sealed class SeoAiAnalyzer(IAiCompletionService completion) : ISeoAiAnalyzer
{
    // "alt_text" is deliberately excluded here even though SeoIssueDetector flags missing alt text —
    // fixing it needs a way to identify WHICH image on the page, and a single {"value": "..."} shape
    // (what every other change type uses, and what the snippet's generic apply logic understands)
    // can't express that safely. Those issues still surface in the review queue; auto-apply for them
    // is a later addition once the fix schema grows a real image selector.
    private const string SystemPrompt = """
        You are an SEO technical analyst. For each issue you are given, propose ONE concrete, safe
        fix. Only handle these categories — skip any issue whose fix cannot be expressed as a single
        replacement value (e.g. missing alt text): "title", "meta_description", "canonical", "schema".
        Respond with ONLY a JSON array, no prose, no markdown fences. Each element:
        {
          "issueId": "<the issue id given to you, unchanged>",
          "changeType": "title" | "meta_description" | "canonical" | "schema",
          "value": "<the exact replacement text/URL/JSON-LD to use>",
          "rationale": "<one sentence explaining the fix>"
        }
        Keep title <= 60 characters and meta_description <= 160 characters. For "schema", value must
        be a valid JSON-LD object serialized as a string. Only propose fixes you are confident are
        correct and safe to apply automatically to a live website — never invent facts about the
        business (address, hours, offerings) that were not given to you.
        """;

    public async Task<IReadOnlyList<ProposedFix>> ProposeFixesAsync(IReadOnlyList<IssueForAnalysis> issues, CancellationToken ct)
    {
        if (issues.Count == 0) return [];

        var userPrompt = JsonSerializer.Serialize(issues.Select(i => new
        {
            issueId                = i.IssueId,
            category                = i.Category,
            title                   = i.Title,
            description             = i.Description,
            pageUrl                 = i.PageUrl,
            currentPageTitle        = i.PageTitle,
            currentMetaDescription  = i.PageMetaDescription,
        }));

        string raw;
        try { raw = await completion.CompleteAsync(SystemPrompt, userPrompt, ct); }
        catch { return []; } // AI not configured, or the call failed — the scan still recorded the issues themselves

        return Parse(raw);
    }

    private static List<ProposedFix> Parse(string raw)
    {
        var result = new List<ProposedFix>();
        try
        {
            using var doc = JsonDocument.Parse(ExtractJsonArray(raw));
            foreach (var el in doc.RootElement.EnumerateArray())
            {
                if (!el.TryGetProperty("issueId", out var idProp) || !Guid.TryParse(idProp.GetString(), out var issueId)) continue;
                if (!el.TryGetProperty("changeType", out var typeProp)) continue;
                if (!el.TryGetProperty("value", out var valueProp)) continue;

                var rationale = el.TryGetProperty("rationale", out var r) ? r.GetString() ?? "" : "";
                var valueJson = JsonSerializer.Serialize(new { value = valueProp.GetString() });
                result.Add(new ProposedFix(issueId, typeProp.GetString() ?? "", valueJson, rationale));
            }
        }
        catch
        {
            // Malformed AI output — the surfaced issues still stand, just with no proposed fix yet.
        }
        return result;
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
