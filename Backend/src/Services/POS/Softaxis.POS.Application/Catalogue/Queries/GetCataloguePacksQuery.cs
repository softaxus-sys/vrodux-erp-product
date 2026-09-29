using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.Catalogue.Dtos;

namespace Softaxis.POS.Application.Catalogue.Queries;

public sealed record GetCataloguePacksQuery : IQuery<IReadOnlyList<CataloguePackDto>>;

public sealed class GetCataloguePacksQueryHandler(ICatalogueProvider catalogue)
    : IQueryHandler<GetCataloguePacksQuery, IReadOnlyList<CataloguePackDto>>
{
    public Task<Result<IReadOnlyList<CataloguePackDto>>> Handle(GetCataloguePacksQuery query, CancellationToken ct)
    {
        IReadOnlyList<CataloguePackDto> packs = catalogue.ListPacks()
            .Select(p => new CataloguePackDto(
                p.Country, p.CountryName, p.Industry, IndustryLabel(p.Industry),
                p.Items.Count, p.TaxRate, p.BuiltAt, p.Source,
                p.Items.GroupBy(i => i.K)
                       .Select(g => new CatalogueCategoryDto(g.Key, g.Count()))
                       .OrderByDescending(c => c.Count).ToList()))
            .OrderBy(p => p.CountryName).ThenBy(p => p.Industry)
            .ToList();

        return Task.FromResult(Result.Success(packs));
    }

    private static string IndustryLabel(string industry) => industry switch
    {
        "grocery" => "Grocery & Supermarket",
        "beauty"  => "Cosmetics & Beauty",
        _         => industry,
    };
}
