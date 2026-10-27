using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Application.ProductTemplates;
using Softaxis.Inventory.Domain.Constants;
using Softaxis.Inventory.Domain.Entities;
using Softaxis.Inventory.Infrastructure.Persistence;

namespace Softaxis.Inventory.Infrastructure.Handlers.ProductTemplates;

/// <summary>Shared rules for listings: choices, slugs, variants, publishing and the DTO shape.</summary>
internal static class ProductTemplateSupport
{
    public static readonly Error NotFound =
        Error.Custom("ProductTemplate.NotFound", "That listing no longer exists.");

    public static Error Invalid(string message) => Error.Custom("ProductTemplate.Invalid", message);
    public static Error Conflict(string message) => Error.Custom("ProductTemplate.Conflict", message);

    // ── Choices ──────────────────────────────────────────────────────────────

    /// <summary>Trims, de-duplicates and bounds the options a listing offers.</summary>
    public static Result<List<ProductOption>> NormaliseOptions(IReadOnlyList<ProductOptionInput> input)
    {
        if (input.Count > ProductTemplate.MaxOptions)
            return Result.Failure<List<ProductOption>>(Invalid($"A product can have at most {ProductTemplate.MaxOptions} options (for example Size, Colour, Material)."));

        var options = new List<ProductOption>();
        foreach (var o in input)
        {
            var name = o.Name?.Trim() ?? "";
            if (name.Length == 0)
                return Result.Failure<List<ProductOption>>(Invalid("Every option needs a name."));
            if (options.Any(x => x.Name.Equals(name, StringComparison.OrdinalIgnoreCase)))
                return Result.Failure<List<ProductOption>>(Invalid($"'{name}' is listed twice."));

            var values = (o.Values ?? [])
                .Select(v => v?.Trim() ?? "")
                .Where(v => v.Length > 0)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
            if (values.Count == 0)
                return Result.Failure<List<ProductOption>>(Invalid($"'{name}' needs at least one value."));

            options.Add(new ProductOption(name, values));
        }
        return Result.Success(options);
    }

    /// <summary>
    /// Checks a variant's choices against the listing's options and returns them spelled exactly as the
    /// options spell them, so "size"="m" and "Size"="M" are the same variant and are stored one way.
    /// </summary>
    public static Result<Dictionary<string, string>> CanonicalChoices(
        IReadOnlyList<ProductOption> options, IReadOnlyDictionary<string, string>? given, string label)
    {
        var result = new Dictionary<string, string>();
        given ??= new Dictionary<string, string>();

        if (options.Count == 0)
            return given.Count == 0
                ? Result.Success(result)
                : Result.Failure<Dictionary<string, string>>(
                    Invalid($"{label}: this product has no options, so a variant cannot choose any."));

        foreach (var option in options)
        {
            var match = given.FirstOrDefault(kv => kv.Key.Trim().Equals(option.Name, StringComparison.OrdinalIgnoreCase));
            var chosen = match.Value?.Trim();
            if (string.IsNullOrEmpty(chosen))
                return Result.Failure<Dictionary<string, string>>(Invalid($"{label}: choose a {option.Name}."));

            var value = option.Values.FirstOrDefault(v => v.Equals(chosen, StringComparison.OrdinalIgnoreCase));
            if (value is null)
                return Result.Failure<Dictionary<string, string>>(
                    Invalid($"{label}: '{chosen}' is not one of the {option.Name} values ({string.Join(", ", option.Values)})."));
            result[option.Name] = value;
        }

        var unknown = given.Keys.FirstOrDefault(k => options.All(o => !o.Name.Equals(k.Trim(), StringComparison.OrdinalIgnoreCase)));
        return unknown is null
            ? Result.Success(result)
            : Result.Failure<Dictionary<string, string>>(Invalid($"{label}: '{unknown}' is not an option of this product."));
    }

    public static string VariantLabel(IReadOnlyDictionary<string, string> choices) =>
        choices.Count == 0 ? "Default" : string.Join(" / ", choices.Values);

    // ── Slug ─────────────────────────────────────────────────────────────────

    /// <summary>A slug no other live listing in this workspace uses: "blue-shirt", then "blue-shirt-2"…</summary>
    public static async Task<string> UniqueSlugAsync(
        InventoryDbContext db, string? requested, string name, Guid? excludeId, CancellationToken ct)
    {
        var baseSlug = ProductTemplate.Slugify(string.IsNullOrWhiteSpace(requested) ? name : requested!);
        var slug = baseSlug;
        for (var n = 2; await db.ProductTemplates.AnyAsync(t => t.Slug == slug && t.Id != (excludeId ?? Guid.Empty), ct); n++)
            slug = $"{baseSlug}-{n}";
        return slug;
    }

    // ── Variants ─────────────────────────────────────────────────────────────

    /// <summary>
    /// Brings products into a listing: existing ones are linked as they are, new ones are created here.
    /// Nothing is saved — the caller saves once, so a failure part-way leaves nothing behind.
    /// </summary>
    public static async Task<Result<List<Product>>> BuildVariantsAsync(
        InventoryDbContext db, ProductTemplate template, IReadOnlyList<ProductOption> options,
        IReadOnlyList<VariantInput> inputs, HashSet<string> takenCombinations, int existingCount, CancellationToken ct)
    {
        if (existingCount + inputs.Count > ProductTemplate.MaxVariants)
            return Result.Failure<List<Product>>(Invalid($"A listing can have at most {ProductTemplate.MaxVariants} variants."));
        if (options.Count == 0 && existingCount + inputs.Count > 1)
            return Result.Failure<List<Product>>(Invalid("A product with no options has a single variant. Add an option such as Size to offer more."));

        // SKUs the new variants want — checked against each other and against every live product.
        var wantedSkus = inputs.Where(i => i.ExistingProductId is null && !string.IsNullOrWhiteSpace(i.SKU))
            .Select(i => i.SKU!.Trim().ToUpperInvariant()).ToList();
        var dupInRequest = wantedSkus.GroupBy(s => s).FirstOrDefault(g => g.Count() > 1);
        if (dupInRequest is not null)
            return Result.Failure<List<Product>>(Conflict($"SKU {dupInRequest.Key} appears more than once."));
        if (wantedSkus.Count > 0)
        {
            var used = await db.Products.Where(p => p.SKU != null && wantedSkus.Contains(p.SKU))
                .Select(p => p.SKU!).FirstOrDefaultAsync(ct);
            if (used is not null)
                return Result.Failure<List<Product>>(Conflict($"SKU {used} is already used by another product."));
        }

        var made = new List<Product>();
        var seen = new HashSet<string>(takenCombinations);
        var pendingIds = new HashSet<Guid>();

        for (var i = 0; i < inputs.Count; i++)
        {
            var input = inputs[i];
            var label = $"Variant {existingCount + i + 1}";

            var choices = CanonicalChoices(options, input.Options, label);
            if (choices.IsFailure) return Result.Failure<List<Product>>(choices.Error);

            var key = ProductTemplate.CombinationKey(choices.Value);
            if (!seen.Add(key))
                return Result.Failure<List<Product>>(Conflict($"{label}: {VariantLabel(choices.Value)} already exists."));

            Product product;
            if (input.ExistingProductId is Guid pid)
            {
                if (!pendingIds.Add(pid))
                    return Result.Failure<List<Product>>(Conflict($"{label}: the same product is listed twice."));

                var existing = await db.Products.FirstOrDefaultAsync(p => p.Id == pid, ct);
                if (existing is null)
                    return Result.Failure<List<Product>>(Error.Custom("ProductTemplate.NotFound", $"{label}: that product no longer exists."));
                if (existing.TemplateId is Guid other && other != template.Id)
                    return Result.Failure<List<Product>>(Conflict($"{label}: '{existing.Name}' already belongs to another listing."));

                product = existing;
                product.SetOnlineDetails(input.SellOnline, input.WeightGrams, input.LengthCm, input.WidthCm, input.HeightCm);
            }
            else
            {
                var name = string.IsNullOrWhiteSpace(input.Name)
                    ? (choices.Value.Count == 0 ? template.Name : $"{template.Name} - {VariantLabel(choices.Value)}")
                    : input.Name!.Trim();

                product = new Product(
                    name, null, input.SKU, input.Barcode,
                    template.CategoryId, template.BrandId, null,
                    input.SalePrice, input.CostPrice, input.TaxRate,
                    string.IsNullOrWhiteSpace(input.Unit) ? "pcs" : input.Unit!,
                    input.OpeningStock, input.ReorderLevel, input.TrackInventory, null);
                product.SetOnlineDetails(input.SellOnline, input.WeightGrams, input.LengthCm, input.WidthCm, input.HeightCm);
                db.Products.Add(product);

                // Same record the Add Product screen leaves for opening stock, so the stock card agrees.
                if (input.OpeningStock > 0 && input.TrackInventory)
                    db.StockMovements.Add(new StockMovement(
                        product.Id, MovementTypes.Receipt, input.OpeningStock, input.CostPrice,
                        "OPENING", "Opening stock", null));
            }

            product.JoinTemplate(template.Id, choices.Value);
            made.Add(product);
        }
        return Result.Success(made);
    }

    /// <summary>The combination keys of the variants already in a listing.</summary>
    public static HashSet<string> CombinationKeys(IEnumerable<Product> variants) =>
        variants.Select(v => ProductTemplate.CombinationKey(v.VariantOptions())).ToHashSet();

    // ── Publishing ───────────────────────────────────────────────────────────

    public static List<string> PublishProblems(ProductTemplate t, IReadOnlyList<Product> variants)
    {
        var problems = new List<string>();
        if (!t.IsActive) problems.Add("The listing is switched off.");
        var sellable = variants.Where(v => v.IsActive && v.SellOnline).ToList();
        if (sellable.Count == 0)
            problems.Add("Add at least one active variant that is offered online.");
        foreach (var v in sellable.Where(v => v.SalePrice <= 0))
            problems.Add($"'{v.Name}' has no price.");
        return problems;
    }

    // ── DTO ──────────────────────────────────────────────────────────────────

    public static TemplateVariantDto ToDto(Product p) => new(
        p.Id, p.Name, p.SKU, p.Barcode, p.VariantOptions(),
        p.SalePrice, p.CostPrice, p.TaxRate, p.StockQuantity, p.TrackInventory,
        p.IsActive, p.SellOnline, p.WeightGrams, p.LengthCm, p.WidthCm, p.HeightCm);

    public static ProductImageDto ToDto(ProductImage i) =>
        new(i.Id, i.ProductId, i.IsPrimary, i.SortOrder, i.FileName, i.AltText);

    /// <summary>Loads everything a listing's screen needs. Photo bytes are never read here.</summary>
    public static async Task<ProductTemplateDto> LoadDtoAsync(InventoryDbContext db, Guid id, CancellationToken ct)
    {
        var t = await db.ProductTemplates.AsNoTracking().FirstAsync(x => x.Id == id, ct);
        var category = await db.ProductCategories.AsNoTracking().Where(c => c.Id == t.CategoryId).Select(c => c.Name).FirstOrDefaultAsync(ct);
        var brand = t.BrandId is Guid b
            ? await db.Brands.AsNoTracking().Where(x => x.Id == b).Select(x => x.Name).FirstOrDefaultAsync(ct)
            : null;

        var variants = await db.Products.AsNoTracking().Where(p => p.TemplateId == id).OrderBy(p => p.CreatedAt).ToListAsync(ct);
        var images = await db.ProductImages.AsNoTracking().Where(i => i.TemplateId == id)
            .OrderByDescending(i => i.IsPrimary).ThenBy(i => i.SortOrder)
            .Select(i => new { i.Id, i.ProductId, i.IsPrimary, i.SortOrder, i.FileName, i.AltText }).ToListAsync(ct);

        return new ProductTemplateDto(
            t.Id, t.Name, t.Description, t.ShortDescription, t.CategoryId, category ?? "", t.BrandId, brand,
            t.Slug, t.SeoTitle, t.MetaDescription, t.Tags,
            t.Options.Select(o => new ProductOptionDto(o.Name, o.Values)).ToList(),
            t.PublishedOnline, t.PublishedAt, t.IsActive,
            variants.Select(ToDto).ToList(),
            images.Select(i => new ProductImageDto(i.Id, i.ProductId, i.IsPrimary, i.SortOrder, i.FileName, i.AltText)).ToList(),
            t.CreatedAt, t.UpdatedAt);
    }

    public static string ImageKey(Guid tenantId, Guid templateId, Guid imageId) =>
        $"inventory/{tenantId:N}/templates/{templateId:N}/{imageId:N}";

    /// <summary>Returns false rather than throwing: a truncated upload is a client error to report.</summary>
    public static bool TryParseDataUri(string value, out byte[] bytes, out string contentType)
    {
        bytes = []; contentType = "image/jpeg";
        var comma = value.IndexOf(',');
        if (comma < 0 || !value.StartsWith("data:", StringComparison.OrdinalIgnoreCase)) return false;
        var header = value[5..comma];
        if (!header.Contains("base64", StringComparison.OrdinalIgnoreCase)) return false;
        var semi = header.IndexOf(';');
        if (semi > 0) contentType = header[..semi];
        try { bytes = Convert.FromBase64String(value[(comma + 1)..]); return bytes.Length > 0; }
        catch (FormatException) { return false; }
    }
}
