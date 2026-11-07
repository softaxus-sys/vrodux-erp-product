namespace Softaxis.Inventory.Application.Abstractions;

/// <summary>What a public product database knows about a barcode. Every field but the name may be empty.</summary>
public sealed record ExternalProductInfoDto(
    string  Code,
    string  Name,
    string? Brand,
    string? Description,
    string? Category,
    string? Quantity,
    string? ImageUrl,
    string  Source,
    string  SourceLabel);

/// <summary>
/// Looks a barcode up in public product databases (Open Food Facts and its sister projects, UPCitemdb).
/// Never throws: an unreachable database is the same as "not found", so adding a product by hand always works.
/// </summary>
public interface IProductCatalogueLookup
{
    Task<ExternalProductInfoDto?> FindAsync(string gtin, CancellationToken ct = default);
}
