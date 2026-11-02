using System.Text.Json;
using System.Text.RegularExpressions;

namespace Softaxis.Inventory.Domain.Entities;

/// <summary>One choice a shopper makes on a product — "Size": S, M, L.</summary>
public sealed record ProductOption(string Name, IReadOnlyList<string> Values);

/// <summary>
/// What a customer sees online: one name, one description, one photo gallery and a set of choices
/// (Size, Colour…). Each combination of choices is a <see cref="Product"/> — an ordinary Inventory
/// product with its own SKU, barcode, price and stock — so POS, Purchase, Sales, Finance and every
/// stock path see a variant as they see any product and none of them has to know templates exist.
///
/// <para>A product that is not sold online needs no template. A product sold online without choices is a
/// template with exactly one variant and no options.</para>
///
/// <para>The template owns the online content (description, SEO, photos). Channels — Shopify, the
/// storefront — read it; they never keep their own copy of what a product is.</para>
/// </summary>
public sealed class ProductTemplate
{
    public const int MaxOptions = 3;
    public const int MaxVariants = 250;

    private ProductTemplate() { }

    public ProductTemplate(string name, Guid categoryId, Guid? brandId, string slug)
    {
        Id         = Guid.NewGuid();
        Name       = name.Trim();
        CategoryId = categoryId;
        BrandId    = brandId;
        Slug       = slug;
        IsActive   = true;
        CreatedAt  = DateTime.UtcNow;
    }

    public Guid      Id               { get; private set; }
    public string    Name             { get; private set; } = string.Empty;
    /// <summary>Full description shown on the product page. Plain text with line breaks or simple HTML.</summary>
    public string?   Description      { get; private set; }
    public string?   ShortDescription { get; private set; }
    public Guid      CategoryId       { get; private set; }
    public Guid?     BrandId          { get; private set; }
    /// <summary>URL piece: <c>/products/{slug}</c>. Unique per workspace among live templates.</summary>
    public string    Slug             { get; private set; } = string.Empty;
    public string?   SeoTitle         { get; private set; }
    public string?   MetaDescription  { get; private set; }
    /// <summary>Comma-separated, used for search and collections.</summary>
    public string?   Tags             { get; private set; }
    /// <summary>JSON <c>[{"name":"Size","values":["S","M"]}]</c>. Null = no choices.</summary>
    public string?   OptionsJson      { get; private set; }
    public bool      PublishedOnline  { get; private set; }
    public DateTime? PublishedAt      { get; private set; }
    public bool      IsActive         { get; private set; }
    public bool      IsDeleted        { get; private set; }
    public DateTime  CreatedAt        { get; private set; }
    public DateTime? UpdatedAt        { get; private set; }

    public ProductCategory?          Category { get; private set; }
    public Brand?                    Brand    { get; private set; }
    public ICollection<Product>      Variants { get; private set; } = new List<Product>();
    public ICollection<ProductImage> Images   { get; private set; } = new List<ProductImage>();

    public IReadOnlyList<ProductOption> Options
    {
        get
        {
            if (string.IsNullOrWhiteSpace(OptionsJson)) return [];
            try { return JsonSerializer.Deserialize<List<ProductOption>>(OptionsJson, Json) ?? []; }
            catch (JsonException) { return []; }   // a damaged value reads as "no choices", never as a crash
        }
    }

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public void UpdateContent(
        string name, string? description, string? shortDescription, Guid categoryId, Guid? brandId,
        string slug, string? seoTitle, string? metaDescription, string? tags)
    {
        Name             = name.Trim();
        Description      = Clean(description);
        ShortDescription = Clean(shortDescription);
        CategoryId       = categoryId;
        BrandId          = brandId;
        Slug             = slug;
        SeoTitle         = Clean(seoTitle);
        MetaDescription  = Clean(metaDescription);
        Tags             = NormaliseTags(tags);
        UpdatedAt        = DateTime.UtcNow;
    }

    public void SetOptions(IReadOnlyList<ProductOption> options)
    {
        OptionsJson = options.Count == 0 ? null : JsonSerializer.Serialize(options, Json);
        UpdatedAt   = DateTime.UtcNow;
    }

    public void Publish()   { PublishedOnline = true;  PublishedAt ??= DateTime.UtcNow; UpdatedAt = DateTime.UtcNow; }
    public void Unpublish() { PublishedOnline = false; UpdatedAt = DateTime.UtcNow; }
    public void Activate()   { IsActive = true;  UpdatedAt = DateTime.UtcNow; }
    public void Deactivate() { IsActive = false; PublishedOnline = false; UpdatedAt = DateTime.UtcNow; }
    public void Delete()     { IsDeleted = true; PublishedOnline = false; UpdatedAt = DateTime.UtcNow; }

    // ── helpers ───────────────────────────────────────────────────────────────

    /// <summary>"Blue Cotton T-Shirt (Slim)" → "blue-cotton-t-shirt-slim". Never empty.</summary>
    public static string Slugify(string text)
    {
        var s = Regex.Replace((text ?? "").Trim().ToLowerInvariant(), @"[^\p{L}\p{N}]+", "-").Trim('-');
        if (s.Length > 120) s = s[..120].Trim('-');
        return s.Length == 0 ? "product" : s;
    }

    /// <summary>Key for a combination of choices — "size=m|colour=red" — order-independent and case-insensitive.</summary>
    public static string CombinationKey(IReadOnlyDictionary<string, string> choices) =>
        string.Join("|", choices
            .OrderBy(kv => kv.Key, StringComparer.OrdinalIgnoreCase)
            .Select(kv => $"{kv.Key.Trim().ToLowerInvariant()}={kv.Value.Trim().ToLowerInvariant()}"));

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    private static string? NormaliseTags(string? tags)
    {
        if (string.IsNullOrWhiteSpace(tags)) return null;
        var parts = tags.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Distinct(StringComparer.OrdinalIgnoreCase);
        var joined = string.Join(",", parts);
        return joined.Length == 0 ? null : joined.Length > 500 ? joined[..500] : joined;
    }
}
