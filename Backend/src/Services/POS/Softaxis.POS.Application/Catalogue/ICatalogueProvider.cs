using Softaxis.POS.Application.Catalogue.Dtos;

namespace Softaxis.POS.Application.Catalogue;

/// <summary>Reads the product packs that ship inside the application (see Backend/tools/catalogue-builder).</summary>
public interface ICatalogueProvider
{
    IReadOnlyList<CataloguePack> ListPacks();
    CataloguePack? Find(string country, string industry);
}
