namespace Softaxis.Construction.Domain.Entities;

public sealed class BillOfQuantity
{
    private BillOfQuantity() { }
    public BillOfQuantity(string projectId, string projectName)
    {
        Id          = Guid.NewGuid();
        BoqNumber   = $"BOQ-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..6].ToUpper()}";
        ProjectId   = projectId; ProjectName = projectName.Trim();
        Status      = "draft"; ApprovedBy = null; ApprovedDate = null;
        Items       = []; CreatedAt = DateTime.UtcNow;
    }
    public Guid      Id            { get; private set; }
    public string    BoqNumber     { get; private set; } = string.Empty;
    public string    ProjectId     { get; private set; } = string.Empty;
    public string    ProjectName   { get; private set; } = string.Empty;
    public string    Status        { get; private set; } = "draft";
    public string?   ApprovedBy    { get; private set; }
    public string?   ApprovedDate  { get; private set; }
    public List<BoqItem> Items     { get; private set; } = [];
    public decimal   TotalAmount   => Items.Sum(i => i.Amount);
    public decimal   CompletedAmount => Items.Sum(i => i.CompletedAmt);
    public decimal   VariationAmount => Items.Sum(i => i.VariationAmt);
    public decimal   FinalAmount   => TotalAmount + VariationAmount;
    public decimal   CompletionPct => TotalAmount > 0 ? CompletedAmount / TotalAmount * 100 : 0;
    public bool      IsDeleted     { get; private set; }
    public DateTime  CreatedAt     { get; private set; }
    public DateTime? UpdatedAt     { get; private set; }
    public void Approve(string by) { Status = "approved"; ApprovedBy = by; ApprovedDate = DateTime.UtcNow.ToString("yyyy-MM-dd"); UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

public sealed class BoqItem
{
    private BoqItem() { }
    public BoqItem(Guid boqId, string itemCode, string description, string unit, decimal quantity, decimal unitRate)
    { Id = Guid.NewGuid(); BoqId = boqId; ItemCode = itemCode; Description = description.Trim(); Unit = unit; Quantity = quantity; UnitRate = unitRate; }
    public Guid         Id           { get; private set; }
    public Guid         BoqId        { get; private set; }
    public string       ItemCode     { get; private set; } = string.Empty;
    public string       Description  { get; private set; } = string.Empty;
    public string       Unit         { get; private set; } = string.Empty;
    public decimal      Quantity     { get; private set; }
    public decimal      UnitRate     { get; private set; }
    public decimal      Amount       => Quantity * UnitRate;
    public decimal      CompletedQty { get; private set; }
    public decimal      CompletedAmt => CompletedQty * UnitRate;
    public decimal      VariationQty { get; private set; }
    public decimal      VariationAmt => VariationQty * UnitRate;
    public BillOfQuantity? Boq       { get; private set; }
    public void UpdateProgress(decimal completedQty) { CompletedQty = completedQty; }
}
