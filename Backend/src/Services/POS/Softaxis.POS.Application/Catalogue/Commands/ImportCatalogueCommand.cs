using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.Catalogue.Dtos;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.Catalogue.Commands;

/// <summary>
/// Copies a bundled catalogue pack into this tenant's POS products. Prices are imported as 0 —
/// the catalogue knows what a product IS, never what this store charges for it.
/// </summary>
public sealed record ImportCatalogueCommand(
    string Country,
    string Industry,
    IReadOnlyList<string>? Categories,
    decimal TaxRate,
    bool TrackInventory = false) : ICommand<ImportCatalogueResultDto>;

public sealed class ImportCatalogueCommandValidator : AbstractValidator<ImportCatalogueCommand>
{
    public ImportCatalogueCommandValidator()
    {
        RuleFor(x => x.Country).NotEmpty().MaximumLength(5);
        RuleFor(x => x.Industry).NotEmpty().MaximumLength(30);
        RuleFor(x => x.TaxRate).InclusiveBetween(0, 100);
    }
}

public sealed class ImportCatalogueCommandHandler(
    ICatalogueProvider         catalogue,
    IProductRepository         productRepo,
    IProductCategoryRepository categoryRepo,
    IUnitOfWork                uow)
    : ICommandHandler<ImportCatalogueCommand, ImportCatalogueResultDto>
{
    private const int SaveEvery = 500;

    public async Task<Result<ImportCatalogueResultDto>> Handle(ImportCatalogueCommand cmd, CancellationToken ct)
    {
        var pack = catalogue.Find(cmd.Country, cmd.Industry);
        if (pack is null)
            return Result.Failure<ImportCatalogueResultDto>(Error.Custom("Catalogue.NotFound",
                $"No product catalogue is bundled for '{cmd.Country}' / '{cmd.Industry}'."));

        var wanted = cmd.Categories is { Count: > 0 }
            ? cmd.Categories.ToHashSet(StringComparer.OrdinalIgnoreCase)
            : null;
        var rows = pack.Items.Where(i => wanted is null || wanted.Contains(i.K)).ToList();

        // One read of the tenant's barcodes instead of a lookup per row.
        var taken = await productRepo.GetAllBarcodesAsync(ct);

        var categories = (await categoryRepo.GetAllAsync(activeOnly: false, ct))
            .GroupBy(c => c.Name, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First().Id, StringComparer.OrdinalIgnoreCase);

        int imported = 0, existing = 0, invalid = 0, created = 0, pending = 0;

        foreach (var row in rows)
        {
            if (!taken.Add(row.C)) { existing++; continue; }

            if (!categories.TryGetValue(row.K, out var categoryId))
            {
                var made = ProductCategory.Create(row.K);
                if (made.IsFailure) { invalid++; continue; }
                categoryRepo.Add(made.Value);
                categoryId = made.Value.Id;
                categories[row.K] = categoryId;
                created++;
            }

            var product = Product.Create(
                row.N, description: null, sku: null, barcode: row.C, categoryId,
                salePrice: 0, costPrice: 0, cmd.TaxRate, unit: "pcs",
                openingStock: 0, reorderLevel: 0, cmd.TrackInventory, imageUrl: null);
            if (product.IsFailure) { invalid++; continue; }

            productRepo.Add(product.Value);
            imported++;

            // Big packs (UAE is ~9k rows) are saved in slices so one failure isn't a giant rollback
            // and the change tracker stays small.
            if (++pending >= SaveEvery)
            {
                await uow.SaveChangesAsync(ct);
                pending = 0;
            }
        }

        if (pending > 0) await uow.SaveChangesAsync(ct);

        return Result.Success(new ImportCatalogueResultDto(imported, existing, invalid, created));
    }
}
