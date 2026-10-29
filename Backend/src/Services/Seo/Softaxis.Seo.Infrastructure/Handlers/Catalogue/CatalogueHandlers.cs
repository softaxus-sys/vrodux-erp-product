using System.Text.Json;
using MediatR;
using Softaxis.AiAssistant.Application.Abstractions;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Application.ProductTemplates;
using Softaxis.Seo.Application.Catalogue;

namespace Softaxis.Seo.Infrastructure.Handlers.Catalogue;

/// <summary>Judges one listing's search text, photos and wording — the same idea as the site rules, applied to the catalogue.</summary>
internal static class CatalogueRules
{
    public static (int Score, List<string> Problems) Judge(CatalogueSeoRowDto r)
    {
        var p = new List<string>();
        if (string.IsNullOrWhiteSpace(r.SeoTitle)) p.Add("title.missing");
        else if (r.SeoTitle!.Length > 60) p.Add("title.long");
        else if (r.SeoTitle.Length < 20) p.Add("title.short");
        if (string.IsNullOrWhiteSpace(r.MetaDescription)) p.Add("desc.missing");
        else if (r.MetaDescription!.Length > 160) p.Add("desc.long");
        else if (r.MetaDescription.Length < 70) p.Add("desc.short");
        if (r.ImageCount == 0) p.Add("image.missing");
        else if (r.ImagesMissingAlt > 0) p.Add("alt.missing");
        if (r.DescriptionWords < 40) p.Add("content.thin");
        var penalty = p.Sum(c => c switch
        {
            "title.missing" or "desc.missing" or "image.missing" => 22,
            "content.thin" => 14,
            "alt.missing" => 8,
            _ => 5,
        });
        return (Math.Clamp(100 - penalty, 0, 100), p);
    }

    public static CatalogueSeoItemDto ToItem(CatalogueSeoRowDto r, HashSet<Guid> duplicateTitles)
    {
        var (score, problems) = Judge(r);
        if (duplicateTitles.Contains(r.Id)) { problems.Add("title.duplicate"); score = Math.Max(0, score - 8); }
        return new CatalogueSeoItemDto(r.Id, r.Name, r.Slug, r.CategoryName, r.PublishedOnline, r.SeoTitle, r.MetaDescription,
            r.DescriptionWords, r.ImageCount, r.ImagesMissingAlt, score, problems);
    }

    public static HashSet<Guid> Duplicates(IReadOnlyList<CatalogueSeoRowDto> rows) =>
        rows.Where(r => !string.IsNullOrWhiteSpace(r.SeoTitle)).GroupBy(r => r.SeoTitle!.Trim().ToLowerInvariant()).Where(g => g.Count() > 1)
            .SelectMany(g => g.Select(r => r.Id)).ToHashSet();
}

internal sealed class GetCatalogueSeoHandler(ISender sender) : IQueryHandler<Softaxis.Seo.Application.Catalogue.GetCatalogueSeoQuery, CatalogueSeoDto>
{
    public async Task<Result<CatalogueSeoDto>> Handle(Softaxis.Seo.Application.Catalogue.GetCatalogueSeoQuery q, CancellationToken ct)
    {
        var rows = await sender.Send(new Softaxis.Inventory.Application.ProductTemplates.GetCatalogueSeoQuery(500), ct);
        if (rows.IsFailure) return Result.Failure<CatalogueSeoDto>(rows.Error);
        var dups = CatalogueRules.Duplicates(rows.Value);
        var items = rows.Value.Select(r => CatalogueRules.ToItem(r, dups)).OrderBy(i => i.Score).ThenBy(i => i.Name).ToList();
        return Result.Success(new CatalogueSeoDto(items.Count, items.Count(i => i.Problems.Count > 0),
            items.Count == 0 ? 0 : (int)Math.Round(items.Average(i => i.Score)), items));
    }
}

internal sealed class SuggestCatalogueSeoHandler(ISender sender, IAiCompletionService completion) : ICommandHandler<SuggestCatalogueSeoCommand, CatalogueSuggestionDto>
{
    private const string SystemPrompt = """
        You write search-engine text for one online shop product. Respond with ONLY a JSON object, no prose, no markdown fences:
        {"seoTitle": "...", "metaDescription": "..."}
        seoTitle: 30-60 characters, the product name plus what it is; no clickbait, no all-caps.
        metaDescription: 120-160 characters, plain sentences that say what the product is and one real benefit.
        Use only facts given to you. Never invent materials, sizes, prices, certifications, discounts or claims.
        """;

    public async Task<Result<CatalogueSuggestionDto>> Handle(SuggestCatalogueSeoCommand cmd, CancellationToken ct)
    {
        var rows = await sender.Send(new Softaxis.Inventory.Application.ProductTemplates.GetCatalogueSeoQuery(1000), ct);
        var row = rows.IsSuccess ? rows.Value.FirstOrDefault(r => r.Id == cmd.Id) : null;
        if (row is null) return Result.Failure<CatalogueSuggestionDto>(Error.Custom("CatalogueSeo.NotFound", "That listing no longer exists."));

        var prompt = JsonSerializer.Serialize(new { name = row.Name, category = row.CategoryName, brand = row.BrandName, shortDescription = row.ShortDescription, description = row.DescriptionExcerpt });
        string raw;
        try { raw = await completion.CompleteAsync(SystemPrompt, prompt, ct); }
        catch (Exception ex) { return Result.Failure<CatalogueSuggestionDto>(Error.Custom("CatalogueSeo.Conflict", ex.Message)); }

        try
        {
            var s = raw.Trim(); var a = s.IndexOf('{'); var b = s.LastIndexOf('}');
            using var doc = JsonDocument.Parse(a >= 0 && b > a ? s[a..(b + 1)] : s);
            var title = doc.RootElement.GetProperty("seoTitle").GetString()?.Trim() ?? "";
            var desc = doc.RootElement.GetProperty("metaDescription").GetString()?.Trim() ?? "";
            if (title.Length == 0 || desc.Length == 0) throw new JsonException();
            string? note = null;
            if (title.Length > 70) { title = title[..70].TrimEnd(); note = "The suggested title was cut to 70 characters."; }
            if (desc.Length > 320) { desc = desc[..320].TrimEnd(); note = "The suggested description was cut."; }
            return Result.Success(new CatalogueSuggestionDto(row.Id, title, desc, note));
        }
        catch (Exception)
        {
            return Result.Failure<CatalogueSuggestionDto>(Error.Custom("CatalogueSeo.Conflict", "The AI did not return usable text. Try again."));
        }
    }
}

internal sealed class ApplyCatalogueSeoHandler(ISender sender) : ICommandHandler<ApplyCatalogueSeoCommand, CatalogueSeoItemDto>
{
    public async Task<Result<CatalogueSeoItemDto>> Handle(ApplyCatalogueSeoCommand cmd, CancellationToken ct)
    {
        var saved = await sender.Send(new SetTemplateSeoCommand(cmd.Id, cmd.SeoTitle, cmd.MetaDescription), ct);
        if (saved.IsFailure)
            return Result.Failure<CatalogueSeoItemDto>(Error.Custom(saved.Error.Code.EndsWith(".NotFound") ? "CatalogueSeo.NotFound" : saved.Error.Code, saved.Error.Description));
        return Result.Success(CatalogueRules.ToItem(saved.Value, []));
    }
}
