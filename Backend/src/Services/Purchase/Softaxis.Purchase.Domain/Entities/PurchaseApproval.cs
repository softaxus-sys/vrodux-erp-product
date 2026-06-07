namespace Softaxis.Purchase.Domain.Entities;

public sealed class PurchaseApproval
{
    private PurchaseApproval() { }
    public PurchaseApproval(string title, string requestedBy, string department, string requiredBy,
        string priority, string category, string? vendorSuggestion, string justification, string currency)
    {
        Id               = Guid.NewGuid();
        RequestNumber    = $"PR-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..6].ToUpper()}";
        Title            = title.Trim(); RequestedBy = requestedBy.Trim(); Department = department.Trim();
        RequestDate      = DateTime.UtcNow.ToString("yyyy-MM-dd"); RequiredBy = requiredBy;
        Status           = "pending"; Priority = priority; Category = category;
        VendorSuggestion = vendorSuggestion?.Trim(); Justification = justification.Trim();
        Currency         = currency; CreatedAt = DateTime.UtcNow;
    }
    public Guid      Id               { get; private set; }
    public string    RequestNumber    { get; private set; } = string.Empty;
    public string    Title            { get; private set; } = string.Empty;
    public string    RequestedBy      { get; private set; } = string.Empty;
    public string    Department       { get; private set; } = string.Empty;
    public string    RequestDate      { get; private set; } = string.Empty;
    public string    RequiredBy       { get; private set; } = string.Empty;
    public string    Status           { get; private set; } = "pending";
    public string    Priority         { get; private set; } = "medium";
    public string    Category         { get; private set; } = string.Empty;
    public string?   VendorSuggestion { get; private set; }
    public decimal   TotalAmount      { get; private set; }
    public string    Currency         { get; private set; } = "AED";
    public string    Justification    { get; private set; } = string.Empty;
    public string?   ApprovedBy       { get; private set; }
    public string?   ApprovedDate     { get; private set; }
    public string?   RejectionReason  { get; private set; }
    public string?   ConvertedToPO    { get; private set; }
    public bool      IsDeleted        { get; private set; }
    public DateTime  CreatedAt        { get; private set; }
    public DateTime? UpdatedAt        { get; private set; }
    public ICollection<PurchaseApprovalItem> Items { get; private set; } = new List<PurchaseApprovalItem>();
    public void RecalcTotal() { TotalAmount = Items.Sum(i => i.Quantity * i.EstimatedUnitPrice); }
    public void Approve(string by) { Status = "approved"; ApprovedBy = by; ApprovedDate = DateTime.UtcNow.ToString("yyyy-MM-dd"); UpdatedAt = DateTime.UtcNow; }
    public void Reject(string by, string reason) { Status = "rejected"; ApprovedBy = by; RejectionReason = reason; UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

public sealed class PurchaseApprovalItem
{
    private PurchaseApprovalItem() { }
    public PurchaseApprovalItem(Guid approvalId, string description, decimal quantity, decimal estimatedUnitPrice)
    { Id = Guid.NewGuid(); ApprovalId = approvalId; Description = description.Trim(); Quantity = quantity; EstimatedUnitPrice = estimatedUnitPrice; }
    public Guid            Id                 { get; private set; }
    public Guid            ApprovalId         { get; private set; }
    public string          Description        { get; private set; } = string.Empty;
    public decimal         Quantity           { get; private set; }
    public decimal         EstimatedUnitPrice { get; private set; }
    public decimal         Total              => Quantity * EstimatedUnitPrice;
    public PurchaseApproval? Approval         { get; private set; }
}
