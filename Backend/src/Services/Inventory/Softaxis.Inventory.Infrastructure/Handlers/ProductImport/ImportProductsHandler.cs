using MediatR;
using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Application.ProductImport;
using Softaxis.Inventory.Application.ProductTemplates;
using Softaxis.Inventory.Domain.Constants;
using Softaxis.Inventory.Domain.Entities;
using Softaxis.Inventory.Infrastructure.Persistence;

namespace Softaxis.Inventory.Infrastructure.Handlers.ProductImport;

internal sealed class ImportProductsHandler(InventoryDbContext db, ISender sender)
    : ICommandHandler<ImportProductsCommand, ImportProductsResult>
{
    private sealed record Line(int Index, ImportProductRow Row, string? Sku, string? Barcode, Product Product, bool IsNew,
        Dictionary<string, string>? Choices);

    public async Task<Result<ImportProductsResult>> Handle(ImportProductsCommand cmd, CancellationToken ct)
    {
        var failed = new List<ImportRowProblem>();
        var notes = new List<string>();
        var rows = cmd.Rows;

        // ── Groups first: a group is all-or-nothing, so one bad row must not leave half a listing behind ──
        var parsed = new Dictionary<int, Dictionary<string, string>>();
        var badGroup = new HashSet<int>();
        foreach (var g in rows.Select((r, i) => (r, i)).Where(x => !string.IsNullOrWhiteSpace(x.r.Group)).GroupBy(x => x.r.Group!.Trim().ToLowerInvariant()))
        {
            var members = g.ToList();
            string? problem = null;
            var sets = new List<Dictionary<string, string>>();
            foreach (var (r, i) in members)
            {
                var choices = ParseOptions(r.Options);
                if (choices is null || choices.Count == 0) { problem = $"Group '{members[0].r.Group!.Trim()}' needs an Options value on every row, like Size=M; Colour=Red."; break; }
                sets.Add(choices);
                parsed[i] = choices;
            }
            if (problem is null)
            {
                var names = sets[0].Keys.Select(k => k.ToLowerInvariant()).OrderBy(k => k).ToList();
                if (names.Count > ProductTemplate.MaxOptions) problem = $"Group '{members[0].r.Group!.Trim()}' has more than {ProductTemplate.MaxOptions} options.";
                else if (sets.Any(s => !s.Keys.Select(k => k.ToLowerInvariant()).OrderBy(k => k).SequenceEqual(names)))
                    problem = $"Group '{members[0].r.Group!.Trim()}': every row must use the same option names.";
                else if (sets.Select(s => ProductTemplate.CombinationKey(s)).Distinct().Count() != sets.Count)
                    problem = $"Group '{members[0].r.Group!.Trim()}' has two rows with the same options.";
            }
            if (problem is not null)
                foreach (var (_, i) in members) { failed.Add(new ImportRowProblem(i, problem)); badGroup.Add(i); }
        }

        // ── Lookups, read once ──────────────────────────────────────────────────────────────────
        var categories = (await db.ProductCategories.ToListAsync(ct)).GroupBy(c => c.Name.Trim().ToLowerInvariant()).ToDictionary(g => g.Key, g => g.First());
        var brands = (await db.Brands.ToListAsync(ct)).GroupBy(b => b.Name.Trim().ToLowerInvariant()).ToDictionary(g => g.Key, g => g.First());
        var uoms = (await db.UnitsOfMeasure.ToListAsync(ct)).GroupBy(u => u.Symbol.Trim().ToLowerInvariant()).ToDictionary(g => g.Key, g => g.First());

        var wantedSkus = rows.Select(r => Norm(r.Sku)?.ToUpperInvariant()).Where(s => s != null).Select(s => s!).Distinct().ToList();
        var wantedBarcodes = rows.Select(r => Norm(r.Barcode)).Where(s => s != null).Select(s => s!).Distinct().ToList();
        var existingBySku = wantedSkus.Count == 0 ? [] : (await db.Products.Where(p => !p.IsDeleted && p.SKU != null && wantedSkus.Contains(p.SKU)).ToListAsync(ct)).ToDictionary(p => p.SKU!, p => p);
        var existingByBarcode = wantedBarcodes.Count == 0 ? [] : (await db.Products.Where(p => !p.IsDeleted && p.Barcode != null && wantedBarcodes.Contains(p.Barcode)).ToListAsync(ct)).GroupBy(p => p.Barcode!).ToDictionary(g => g.Key, g => g.First());

        var lines = new List<Line>();
        var seenSkus = new HashSet<string>();
        var seenBarcodes = new HashSet<string>();
        var created = 0; var existing = 0;

        for (var i = 0; i < rows.Count; i++)
        {
            if (badGroup.Contains(i)) continue;
            var r = rows[i];
            var name = Norm(r.Name);
            if (name is null) { failed.Add(new ImportRowProblem(i, "The item has no name.")); continue; }
            if (name.Length > 200) { failed.Add(new ImportRowProblem(i, "The name is longer than 200 characters.")); continue; }
            if (r.SalePrice < 0 || r.CostPrice < 0 || r.OpeningStock < 0 || r.ReorderLevel < 0 || r.TaxRate is < 0 or > 100)
            { failed.Add(new ImportRowProblem(i, "A price, quantity or tax rate is negative or out of range.")); continue; }

            var sku = Norm(r.Sku)?.ToUpperInvariant();
            var barcode = Norm(r.Barcode);
            if (sku is { Length: > 100 } || barcode is { Length: > 100 }) { failed.Add(new ImportRowProblem(i, "The SKU or barcode is longer than 100 characters.")); continue; }
            if (sku != null && !seenSkus.Add(sku)) { failed.Add(new ImportRowProblem(i, $"SKU {sku} appears more than once in the file.")); continue; }
            if (barcode != null && !seenBarcodes.Add(barcode)) { failed.Add(new ImportRowProblem(i, $"Barcode {barcode} appears more than once in the file.")); continue; }

            // Already in stock: leave it alone.
            Product? found = null;
            if (sku != null) existingBySku.TryGetValue(sku, out found);
            else if (barcode != null) existingByBarcode.TryGetValue(barcode, out found);
            if (found is not null)
            {
                existing++;
                lines.Add(new Line(i, r, sku, barcode, found, false, parsed.GetValueOrDefault(i)));
                continue;
            }
            if (barcode != null && existingByBarcode.TryGetValue(barcode, out var holder))
            { failed.Add(new ImportRowProblem(i, $"Barcode {barcode} is already used by '{holder.Name}'.")); continue; }

            // Category by name (created when new), brand by name (created when new), unit by symbol.
            var catName = Norm(r.Category) ?? "General";
            if (!categories.TryGetValue(catName.ToLowerInvariant(), out var category))
            {
                category = new ProductCategory(catName, null, null, null);
                db.ProductCategories.Add(category);
                categories[catName.ToLowerInvariant()] = category;
            }
            Brand? brand = null;
            if (Norm(r.Brand) is { } brandName && !brands.TryGetValue(brandName.ToLowerInvariant(), out brand))
            {
                brand = new Brand(brandName, null, null, null);
                db.Brands.Add(brand);
                brands[brandName.ToLowerInvariant()] = brand;
            }
            var unitText = Norm(r.Unit) ?? "pcs";
            uoms.TryGetValue(unitText.ToLowerInvariant(), out var uom);

            var product = new Product(name, Norm(r.Description), sku, barcode, category.Id, brand?.Id, uom?.Id,
                r.SalePrice, r.CostPrice, r.TaxRate, unitText, r.OpeningStock, r.ReorderLevel, true, null);
            db.Products.Add(product);
            if (r.OpeningStock > 0)
                db.StockMovements.Add(new StockMovement(product.Id, MovementTypes.Receipt, r.OpeningStock, r.CostPrice, "OPENING", "Opening stock", null));
            created++;
            lines.Add(new Line(i, r, sku, barcode, product, true, parsed.GetValueOrDefault(i)));
        }

        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException)
        {
            return Result.Failure<ImportProductsResult>(Error.Custom("ProductImport.Conflict",
                "Someone else added an item with the same SKU or barcode while this file was importing. Nothing was imported — run it again."));
        }

        // ── Pictures: queued, downloaded in the background ───────────────────────────────────────
        var photosQueued = 0;
        var existingIds = lines.Where(l => !l.IsNew).Select(l => l.Product.Id).ToList();
        var haveSomething = new HashSet<Guid>();
        if (existingIds.Count > 0)
        {
            foreach (var id in await db.ProductImages.Where(i => i.ProductId != null && existingIds.Contains(i.ProductId.Value)).Select(i => i.ProductId!.Value).Distinct().ToListAsync(ct)) haveSomething.Add(id);
            foreach (var id in await db.PendingProductPhotos.Where(p => existingIds.Contains(p.ProductId) && p.Status != PendingProductPhoto.Failed).Select(p => p.ProductId).Distinct().ToListAsync(ct)) haveSomething.Add(id);
        }
        foreach (var l in lines)
        {
            if (l.Row.ImageUrls is not { Count: > 0 }) continue;
            // A re-run must not pile a second set of pictures onto an item that already has some.
            if (!l.IsNew && haveSomething.Contains(l.Product.Id)) continue;

            // Links tried before and failed are replaced by this run's, so the failure list never shows the same one twice.
            if (!l.IsNew)
                db.PendingProductPhotos.RemoveRange(await db.PendingProductPhotos
                    .Where(p => p.ProductId == l.Product.Id && p.Status == PendingProductPhoto.Failed).ToListAsync(ct));

            var urls = l.Row.ImageUrls.Select(Norm).Where(u => u != null).Select(u => u!).Distinct().ToList();
            var pos = 0;
            foreach (var url in urls)
            {
                if (pos >= ImportProductsCommandValidator.MaxPhotosPerItem) { notes.Add($"Row {l.Index + 2}: only the first {ImportProductsCommandValidator.MaxPhotosPerItem} pictures are used."); break; }
                if (url.Length > 2000 || !Uri.TryCreate(url, UriKind.Absolute, out var u) || (u.Scheme != Uri.UriSchemeHttp && u.Scheme != Uri.UriSchemeHttps))
                { notes.Add($"Row {l.Index + 2}: '{(url.Length > 60 ? url[..60] + "…" : url)}' is not a web address, so it was skipped."); continue; }
                db.PendingProductPhotos.Add(new PendingProductPhoto(l.Product.Id, url, pos++));
                photosQueued++;
            }
        }
        if (photosQueued > 0) await db.SaveChangesAsync(ct);

        // ── Online listings ───────────────────────────────────────────────────────────────────────
        var listed = 0;
        if (cmd.ListOnline)
        {
            var unlisted = lines.Where(l => l.Product.TemplateId is null && l.Product.IsActive).ToList();

            foreach (var group in unlisted.Where(l => l.Choices is not null).GroupBy(l => l.Row.Group!.Trim().ToLowerInvariant()))
            {
                var members = group.OrderBy(l => l.Index).ToList();
                var first = members[0];
                var optionNames = first.Choices!.Keys.ToList();
                var options = optionNames.Select(n => new ProductOptionInput(n,
                    members.Select(m => m.Choices!.First(kv => kv.Key.Equals(n, StringComparison.OrdinalIgnoreCase)).Value).Distinct(StringComparer.OrdinalIgnoreCase).ToList())).ToList();
                var variants = members.Select(m => new VariantInput(m.Product.Id, m.Choices!)).ToList();
                var content = new ProductTemplateContent(first.Row.Group!.Trim(), Norm(first.Row.Description), null,
                    first.Product.CategoryId, first.Product.BrandId, null, null, null, null);

                var made = await sender.Send(new CreateProductTemplateCommand(content, options, variants), ct);
                if (made.IsSuccess) listed++;
                else notes.Add($"Group '{first.Row.Group!.Trim()}' was created in stock but could not be listed online: {made.Error.Description}");
            }

            var single = unlisted.Where(l => l.Choices is null).Select(l => l.Product.Id).ToList();
            if (single.Count > 0)
            {
                var res = await sender.Send(new ListProductsOnlineCommand(single), ct);
                if (res.IsSuccess) listed += res.Value.Created;
                else notes.Add($"Listing online failed: {res.Error.Description}");
            }
        }

        return Result.Success(new ImportProductsResult(created, existing, listed, photosQueued,
            failed.OrderBy(f => f.Index).Take(100).ToList(), notes.Take(30).ToList()));
    }

    private static string? Norm(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    /// <summary>"Size=M; Colour=Red" → {Size: M, Colour: Red}. Null when it cannot be read.</summary>
    private static Dictionary<string, string>? ParseOptions(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var part in text.Split([';', '|'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            var eq = part.IndexOf('=');
            if (eq <= 0 || eq == part.Length - 1) return null;
            var key = part[..eq].Trim(); var value = part[(eq + 1)..].Trim();
            if (key.Length == 0 || value.Length == 0 || !result.TryAdd(key, value)) return null;
        }
        return result;
    }
}

internal sealed class GetImportPhotoStatusHandler(InventoryDbContext db)
    : IQueryHandler<GetImportPhotoStatusQuery, ImportPhotoStatusDto>
{
    public async Task<Result<ImportPhotoStatusDto>> Handle(GetImportPhotoStatusQuery q, CancellationToken ct)
    {
        var since = DateTime.UtcNow.AddDays(-1);
        var pending = await db.PendingProductPhotos.CountAsync(p => p.Status == PendingProductPhoto.Pending, ct);
        var failedCount = await db.PendingProductPhotos.CountAsync(p => p.Status == PendingProductPhoto.Failed, ct);
        var done = await db.PendingProductPhotos.CountAsync(p => p.Status == PendingProductPhoto.Done && p.UpdatedAt >= since, ct);

        var failures = await db.PendingProductPhotos.AsNoTracking().Where(p => p.Status == PendingProductPhoto.Failed)
            .OrderByDescending(p => p.UpdatedAt).Take(50).ToListAsync(ct);
        var ids = failures.Select(f => f.ProductId).Distinct().ToList();
        var names = await db.Products.AsNoTracking().Where(p => ids.Contains(p.Id)).ToDictionaryAsync(p => p.Id, p => p.Name, ct);

        return Result.Success(new ImportPhotoStatusDto(pending, failedCount, done,
            failures.Select(f => new ImportPhotoFailureDto(f.Id, f.ProductId, names.GetValueOrDefault(f.ProductId, ""), f.Url, f.Error)).ToList()));
    }
}

internal sealed class RetryFailedImportPhotosHandler(InventoryDbContext db)
    : ICommandHandler<RetryFailedImportPhotosCommand, int>
{
    public async Task<Result<int>> Handle(RetryFailedImportPhotosCommand cmd, CancellationToken ct)
    {
        var failed = await db.PendingProductPhotos.Where(p => p.Status == PendingProductPhoto.Failed).ToListAsync(ct);
        foreach (var f in failed) f.Requeue();
        await db.SaveChangesAsync(ct);
        return Result.Success(failed.Count);
    }
}
