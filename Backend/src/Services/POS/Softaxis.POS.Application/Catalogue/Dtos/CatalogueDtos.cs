namespace Softaxis.POS.Application.Catalogue.Dtos;

public sealed record CatalogueCategoryDto(string Name, int Count);

public sealed record CataloguePackDto(
    string Country,
    string CountryName,
    string Industry,
    string IndustryLabel,
    int    ProductCount,
    decimal TaxRate,
    string BuiltAt,
    string Source,
    IReadOnlyList<CatalogueCategoryDto> Categories);

public sealed record ImportCatalogueResultDto(
    int Imported,
    int SkippedExisting,
    int SkippedInvalid,
    int CategoriesCreated);

/// <summary>One product row inside a bundled pack (short keys keep the gzip small).</summary>
public sealed record CatalogueItem(string C, string N, string? B, string? Q, string K);

public sealed record CataloguePack(
    string Country,
    string CountryName,
    string Industry,
    decimal TaxRate,
    string Source,
    string BuiltAt,
    IReadOnlyList<CatalogueItem> Items);
