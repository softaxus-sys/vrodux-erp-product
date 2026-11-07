using System.Text;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.POS.Infrastructure.Persistence;

namespace Softaxis.POS.Infrastructure.Services;

/// <summary>Category and cost of a product, whichever schema it lives in.</summary>
internal sealed record ProductInfo(Guid CategoryId, string? CategoryName, decimal CostPrice);

/// <summary>
/// Reports group sales by category and work out margin from cost. A sale line stores a product id and
/// a snapshot of what was sold, but not the category or the cost — those are looked up, and the till
/// sells from both the POS and the Inventory schema (see <c>CrossSchemaProductService</c>). Looking only
/// in the POS schema turned every Inventory-catalogue sale into "Uncategorised" with zero cost.
/// </summary>
internal static class ProductInfoLookup
{
    private const int ChunkSize = 1000;   // well under SQL Server's 2,100-parameter ceiling

    private sealed class Row
    {
        public Guid    Id           { get; set; }
        public Guid    CategoryId   { get; set; }
        public string? CategoryName { get; set; }
        public decimal CostPrice    { get; set; }
    }

    public static async Task<Dictionary<Guid, ProductInfo>> GetAsync(
        POSDbContext db, IReadOnlyCollection<Guid> productIds, CancellationToken ct)
    {
        var result = new Dictionary<Guid, ProductInfo>();
        if (productIds.Count == 0) return result;

        // Raw SQL bypasses EF's global tenant filter — replicate it explicitly.
        int  bypass = TenantAmbient.BypassFilter ? 1 : 0;
        Guid tenant = TenantAmbient.TenantId ?? Guid.Empty;

        foreach (var chunk in productIds.Chunk(ChunkSize))
        {
            var names = chunk.Select((_, i) => $"@p{i}").ToArray();
            var inList = string.Join(",", names);
            var sql = new StringBuilder($"""
                SELECT p.Id, p.CategoryId, c.Name AS CategoryName, p.CostPrice
                FROM  [pos].[products] p
                LEFT  JOIN [pos].[product_categories] c ON c.Id = p.CategoryId
                WHERE p.Id IN ({inList}) AND (@bypass = 1 OR p.TenantId = @tenant)

                UNION ALL

                SELECT p.Id, p.CategoryId, c.Name AS CategoryName, p.CostPrice
                FROM  [inventory].[products] p
                LEFT  JOIN [inventory].[product_categories] c ON c.Id = p.CategoryId
                WHERE p.Id IN ({inList}) AND (@bypass = 1 OR p.TenantId = @tenant)
                """).ToString();

            var args = new List<object> { };
            for (var i = 0; i < chunk.Length; i++) args.Add(new SqlParameter($"@p{i}", chunk[i]));
            args.Add(new SqlParameter("@bypass", bypass));
            args.Add(new SqlParameter("@tenant", tenant));

            var rows = await db.Database.SqlQueryRaw<Row>(sql, args.ToArray()).ToListAsync(ct);
            // A product present in both schemas (a mid-move catalogue) is described by its first row.
            foreach (var r in rows) result.TryAdd(r.Id, new ProductInfo(r.CategoryId, r.CategoryName, r.CostPrice));
        }
        return result;
    }
}
