namespace Softaxis.Inventory.Domain.Entities;

/// <summary>
/// The record of a workspace's product catalogue being moved from the POS schema into Inventory.
/// Written by the move itself (in its transaction), never edited. It is how a workspace is known to
/// have been moved, what the move did, and the report the operator saw before confirming.
/// </summary>
public sealed class CatalogueMove
{
    private CatalogueMove() { }

    public Guid     Id               { get; private set; }
    public int      ProductsMoved    { get; private set; }
    /// <summary>Products that already existed in Inventory under the same id and were left as they were.</summary>
    public int      AlreadyThere     { get; private set; }
    public int      CategoriesCreated { get; private set; }
    public int      WarehousesCreated { get; private set; }
    public int      StockBuckets     { get; private set; }
    public string   MovedBy          { get; private set; } = string.Empty;
    public DateTime MovedAt          { get; private set; }
    /// <summary>The dry-run report as it stood at the moment of the move (JSON).</summary>
    public string?  Report           { get; private set; }
}
