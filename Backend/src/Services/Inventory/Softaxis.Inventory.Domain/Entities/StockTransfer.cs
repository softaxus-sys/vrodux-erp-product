namespace Softaxis.Inventory.Domain.Entities;

public sealed class StockTransfer
{
    private StockTransfer() { }
    public StockTransfer(string fromWarehouseId, string fromWarehouseName, string toWarehouseId,
        string toWarehouseName, string requestedBy, string expectedDate, string? notes)
    {
        Id                 = Guid.NewGuid();
        TransferNumber     = $"TRF-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..6].ToUpper()}";
        FromWarehouseId    = fromWarehouseId; FromWarehouseName = fromWarehouseName.Trim();
        ToWarehouseId      = toWarehouseId;   ToWarehouseName   = toWarehouseName.Trim();
        Status             = "draft"; RequestedBy = requestedBy.Trim();
        RequestDate        = DateTime.UtcNow.ToString("yyyy-MM-dd");
        ExpectedDate       = expectedDate; Notes = notes?.Trim();
        CreatedAt          = DateTime.UtcNow;
    }
    public Guid      Id               { get; private set; }
    public string    TransferNumber   { get; private set; } = string.Empty;
    public string    FromWarehouseId  { get; private set; } = string.Empty;
    public string    FromWarehouseName{ get; private set; } = string.Empty;
    public string    ToWarehouseId    { get; private set; } = string.Empty;
    public string    ToWarehouseName  { get; private set; } = string.Empty;
    public string    Status           { get; private set; } = "draft";
    public string    RequestedBy      { get; private set; } = string.Empty;
    public string?   ApprovedBy       { get; private set; }
    public string    RequestDate      { get; private set; } = string.Empty;
    public string    ExpectedDate     { get; private set; } = string.Empty;
    public string?   ReceivedDate     { get; private set; }
    public decimal   TotalValue       { get; private set; }
    public string?   Notes            { get; private set; }
    public bool      IsDeleted        { get; private set; }
    public DateTime  CreatedAt        { get; private set; }
    public DateTime? UpdatedAt        { get; private set; }
    public ICollection<StockTransferItem> Items { get; private set; } = new List<StockTransferItem>();
    public void RecalcTotal() { TotalValue = Items.Sum(i => i.Quantity * i.UnitCost); }
    public void Submit() { Status = "pending"; UpdatedAt = DateTime.UtcNow; }
    public void Approve(string by) { Status = "in_transit"; ApprovedBy = by; UpdatedAt = DateTime.UtcNow; }
    public void Receive() { Status = "received"; ReceivedDate = DateTime.UtcNow.ToString("yyyy-MM-dd"); UpdatedAt = DateTime.UtcNow; }
    public void Cancel() { Status = "cancelled"; UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

public sealed class StockTransferItem
{
    private StockTransferItem() { }
    public StockTransferItem(Guid transferId, string stockItemId, string itemName, string sku, decimal quantity, decimal unitCost)
    { Id = Guid.NewGuid(); TransferId = transferId; StockItemId = stockItemId; ItemName = itemName.Trim(); Sku = sku; Quantity = quantity; UnitCost = unitCost; }
    public Guid           Id          { get; private set; }
    public Guid           TransferId  { get; private set; }
    public string         StockItemId { get; private set; } = string.Empty;
    public string         ItemName    { get; private set; } = string.Empty;
    public string         Sku         { get; private set; } = string.Empty;
    public decimal        Quantity    { get; private set; }
    public decimal        UnitCost    { get; private set; }
    public decimal        Total       => Quantity * UnitCost;
    public StockTransfer? Transfer    { get; private set; }
}
