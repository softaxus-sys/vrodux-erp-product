using System.IO.Compression;
using System.Text.Json;
using Softaxis.POS.Application.Catalogue;
using Softaxis.POS.Application.Catalogue.Dtos;

namespace Softaxis.POS.Infrastructure.Catalogue;

/// <summary>
/// Serves the gzip'd JSON packs embedded in this assembly. Being embedded (not loose files) means they
/// survive the self-contained single-folder publish the on-prem installer uses. Loaded lazily and cached —
/// packs are immutable for the life of the process.
/// </summary>
public sealed class EmbeddedCatalogueProvider : ICatalogueProvider
{
    private static readonly JsonSerializerOptions Json = new() { PropertyNameCaseInsensitive = true };
    private readonly Lazy<IReadOnlyList<CataloguePack>> _packs = new(Load);

    public IReadOnlyList<CataloguePack> ListPacks() => _packs.Value;

    public CataloguePack? Find(string country, string industry) =>
        _packs.Value.FirstOrDefault(p =>
            p.Country.Equals(country, StringComparison.OrdinalIgnoreCase) &&
            p.Industry.Equals(industry, StringComparison.OrdinalIgnoreCase));

    private static IReadOnlyList<CataloguePack> Load()
    {
        var asm = typeof(EmbeddedCatalogueProvider).Assembly;
        var packs = new List<CataloguePack>();

        foreach (var name in asm.GetManifestResourceNames()
                     .Where(n => n.EndsWith(".json.gz", StringComparison.OrdinalIgnoreCase)))
        {
            using var raw  = asm.GetManifestResourceStream(name)!;
            using var gzip = new GZipStream(raw, CompressionMode.Decompress);
            var file = JsonSerializer.Deserialize<PackFile>(gzip, Json);
            if (file is null) continue;

            packs.Add(new CataloguePack(
                file.Country, file.CountryName, file.Industry, file.TaxRate, file.Source, file.BuiltAt,
                file.Items.Select(i => new CatalogueItem(i.C, i.N, i.B, i.Q, i.K)).ToList()));
        }
        return packs;
    }

    private sealed record PackFile(
        string Country, string CountryName, string Industry, decimal TaxRate,
        string Source, string BuiltAt, List<ItemRow> Items);

    private sealed record ItemRow(string C, string N, string? B, string? Q, string K);
}
