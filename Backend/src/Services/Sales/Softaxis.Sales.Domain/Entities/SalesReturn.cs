namespace Softaxis.Sales.Domain.Entities;

public sealed class SalesReturn
{
    private SalesReturn() { }
    public SalesReturn(string orderId, string orderNumber, string customerId, string customerName, string reason, string reasonDetail)
    {
        Id           = Guid.NewGuid();
        ReturnNumber = $"RET-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..6].ToUpper()}";
        OrderId      = orderId; OrderNumber = orderNumber;
        CustomerId   = customerId; CustomerName = customerName.Trim();
        RequestDate  = DateTime.UtcNow.ToString("yyyy-MM-dd");
        Status       = "pending"; Reason = reason; ReasonDetail = reasonDetail.Trim();
        Currency     = "AED"; CreatedAt = DateTime.UtcNow;
    }
    public Guid      Id            { get; private set; }
    public string    ReturnNumber  { get; private set; } = string.Empty;
    public string    OrderId       { get; private set; } = string.Empty;
    public string    OrderNumber   { get; private set; } = string.Empty;
    public string    CustomerId    { get; private set; } = string.Empty;
    public string    CustomerName  { get; private set; } = string.Empty;
    public string    RequestDate   { get; private set; } = string.Empty;
    public string    Status        { get; private set; } = "pending";
    public string    Reason        { get; private set; } = string.Empty;
    public string    ReasonDetail  { get; private set; } = string.Empty;
    public decimal   RefundAmount  { get; private set; }
    public string    Currency      { get; private set; } = "AED";
    public string?   CreditNote    { get; private set; }
    public string?   ProcessedBy   { get; private set; }
    public string?   ProcessedDate { get; private set; }
    public string?   RefundMethod  { get; private set; }
    public bool      IsDeleted     { get; private set; }
    public DateTime  CreatedAt     { get; private set; }
    public DateTime? UpdatedAt     { get; private set; }
    public ICollection<SalesReturnItem> Items { get; private set; } = new List<SalesReturnItem>();
    public void Approve(string by) { Status = "approved"; ProcessedBy = by; ProcessedDate = DateTime.UtcNow.ToString("yyyy-MM-dd"); UpdatedAt = DateTime.UtcNow; }
    public void Reject(string by)  { Status = "rejected"; ProcessedBy = by; ProcessedDate = DateTime.UtcNow.ToString("yyyy-MM-dd"); UpdatedAt = DateTime.UtcNow; }
    public void Complete(string method) { Status = "completed"; RefundMethod = method; RefundAmount = Items.Sum(i => i.Quantity * i.UnitPrice); UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

public sealed class SalesReturnItem
{
    private SalesReturnItem() { }
    public SalesReturnItem(Guid returnId, string description, decimal quantity, decimal unitPrice)
    { Id = Guid.NewGuid(); ReturnId = returnId; Description = description.Trim(); Quantity = quantity; UnitPrice = unitPrice; }
    public Guid         Id          { get; private set; }
    public Guid         ReturnId    { get; private set; }
    public string       Description { get; private set; } = string.Empty;
    public decimal      Quantity    { get; private set; }
    public decimal      UnitPrice   { get; private set; }
    public decimal      Total       => Quantity * UnitPrice;
    public SalesReturn? Return      { get; private set; }
}
