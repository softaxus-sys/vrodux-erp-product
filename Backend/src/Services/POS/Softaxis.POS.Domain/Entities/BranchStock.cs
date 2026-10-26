using Softaxis.BuildingBlocks.Domain.Primitives;

namespace Softaxis.POS.Domain.Entities;

/// <summary>
/// How much of a product one branch holds. The branch server is the only writer of its own branch's rows
/// (it refreshes them from its local stock figures before each upload), so they flow up to head office
/// without conflict and head office can see stock per branch. Head office's own <c>Product.StockQuantity</c>
/// is not touched by a branch's sales - see docs/branch-server-design.md.
/// </summary>
public sealed class BranchStock : AuditableEntity<Guid>
{
    public Guid    BranchId      { get; private set; }
    public Guid    ProductId     { get; private set; }
    public decimal StockQuantity { get; private set; }

    private BranchStock() { }
}
