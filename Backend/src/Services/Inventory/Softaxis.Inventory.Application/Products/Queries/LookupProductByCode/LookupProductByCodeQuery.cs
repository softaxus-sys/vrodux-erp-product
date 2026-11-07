using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Application.Abstractions;
using Softaxis.Inventory.Application.DTOs;

namespace Softaxis.Inventory.Application.Products.Queries.LookupProductByCode;

/// <summary>
/// What the scan screens ask: "what is this code?". Answers with the product already in stock (if any) and,
/// when there is none, what the public product databases know about it so a new product can be pre-filled.
/// </summary>
public sealed record LookupProductByCodeQuery(string Code) : IQuery<ProductLookupDto>;

/// <param name="Code">The code as cleaned up from the scan (a QR link becomes the number inside it).</param>
/// <param name="Existing">The product already in this workspace's stock, if the code matches one.</param>
/// <param name="Suggested">Details from a public database, only looked up when nothing matched locally.</param>
public sealed record ProductLookupDto(string Code, ProductDto? Existing, ExternalProductInfoDto? Suggested);

public sealed class LookupProductByCodeQueryHandler(IProductReadService readService, IProductCatalogueLookup catalogue)
    : IQueryHandler<LookupProductByCodeQuery, ProductLookupDto>
{
    public async Task<Result<ProductLookupDto>> Handle(LookupProductByCodeQuery query, CancellationToken ct)
    {
        var parsed = ScannedCode.Parse(query.Code);
        if (parsed is null)
            return Result.Failure<ProductLookupDto>(Error.Custom("Validation.Failed",
                "That scan did not contain a product code. Try again, or type the code in."));

        foreach (var candidate in parsed.Candidates)
        {
            var found = await readService.GetByBarcodeAsync(candidate, ct);
            if (found is not null) return Result.Success(new ProductLookupDto(parsed.Primary, found, null));
        }

        // A shop's own QR often holds just the SKU.
        if (parsed.Gtin is null)
        {
            var page = await readService.GetCombinedPagedAsync(1, 5, parsed.Primary, ct: ct);
            var bySku = page.Items.FirstOrDefault(p => string.Equals(p.SKU, parsed.Primary, StringComparison.OrdinalIgnoreCase));
            if (bySku is not null)
            {
                var full = await readService.GetByIdAsync(bySku.Id, ct);
                if (full is not null) return Result.Success(new ProductLookupDto(parsed.Primary, full, null));
            }
        }

        // Public databases only know numeric trade codes; asking them about a SKU is wasted time.
        var suggested = parsed.Gtin is null ? null : await catalogue.FindAsync(parsed.Gtin, ct);
        return Result.Success(new ProductLookupDto(parsed.Gtin ?? parsed.Primary, null, suggested));
    }
}
