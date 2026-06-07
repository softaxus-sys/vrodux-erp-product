namespace Softaxis.Construction.Domain.Entities;

// ── CRM-linked construction bidding lifecycle ────────────────────────────────
// Lead → RFQ → Estimate → Proposal → Contract → Project.
// Each entity references the core CRM Lead/Deal/Customer by ID (reuse, not rebuild).

/// <summary>A client's Request For Quote, originating from a CRM lead.</summary>
public sealed class Rfq
{
    private Rfq() { }
    public Rfq(Guid? leadId, Guid? customerId, string clientName, string projectTitle, string? scope,
        decimal? budget, string dueDate, string assignedTo, string? notes)
    {
        Id = Guid.NewGuid();
        RfqNumber = $"RFQ-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..5].ToUpper()}";
        LeadId = leadId; CustomerId = customerId; ClientName = clientName.Trim();
        ProjectTitle = projectTitle.Trim(); Scope = scope?.Trim(); Budget = budget;
        DueDate = dueDate; AssignedTo = assignedTo.Trim(); Notes = notes?.Trim(); Status = "open";
        CreatedAt = DateTime.UtcNow;
    }
    public Guid     Id           { get; private set; }
    public string   RfqNumber    { get; private set; } = string.Empty;
    public Guid?    LeadId       { get; private set; }
    public Guid?    CustomerId   { get; private set; }
    public string   ClientName   { get; private set; } = string.Empty;
    public string   ProjectTitle { get; private set; } = string.Empty;
    public string?  Scope        { get; private set; }
    public decimal? Budget       { get; private set; }
    public string   DueDate      { get; private set; } = string.Empty;
    public string   Status       { get; private set; } = "open"; // open | quoted | won | lost
    public string   AssignedTo   { get; private set; } = string.Empty;
    public string?  Notes        { get; private set; }
    public bool     IsDeleted    { get; private set; }
    public DateTime CreatedAt    { get; private set; }
    public DateTime UpdatedAt    { get; private set; } = DateTime.UtcNow;

    public void SetStatus(string s) { Status = s; UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

/// <summary>A priced estimate/proposal for an RFQ, tied to a CRM deal.</summary>
public sealed class Estimate
{
    private Estimate() { }
    public Estimate(Guid? rfqId, Guid? dealId, Guid? customerId, string clientName, string title,
        decimal amount, string validUntil, string? notes)
    {
        Id = Guid.NewGuid();
        EstimateNumber = $"EST-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..5].ToUpper()}";
        RfqId = rfqId; DealId = dealId; CustomerId = customerId; ClientName = clientName.Trim();
        Title = title.Trim(); Amount = amount; ValidUntil = validUntil; Notes = notes?.Trim(); Status = "draft";
        CreatedAt = DateTime.UtcNow;
    }
    public Guid     Id             { get; private set; }
    public string   EstimateNumber { get; private set; } = string.Empty;
    public Guid?    RfqId          { get; private set; }
    public Guid?    DealId         { get; private set; }
    public Guid?    CustomerId     { get; private set; }
    public string   ClientName     { get; private set; } = string.Empty;
    public string   Title          { get; private set; } = string.Empty;
    public decimal  Amount         { get; private set; }
    public string   ValidUntil     { get; private set; } = string.Empty;
    public string   Status         { get; private set; } = "draft"; // draft | sent | approved | rejected
    public string?  Notes          { get; private set; }
    public bool     IsDeleted      { get; private set; }
    public DateTime CreatedAt      { get; private set; }
    public DateTime UpdatedAt      { get; private set; } = DateTime.UtcNow;

    public void SetStatus(string s) { Status = s; UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

/// <summary>A signed construction contract that kicks off a project.</summary>
public sealed class ConstructionContract
{
    private ConstructionContract() { }
    public ConstructionContract(Guid? dealId, Guid? customerId, Guid? estimateId, string clientName, string title,
        decimal contractValue, string startDate, string endDate, string? contractor, string? notes)
    {
        Id = Guid.NewGuid();
        ContractNumber = $"CON-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..5].ToUpper()}";
        DealId = dealId; CustomerId = customerId; EstimateId = estimateId; ClientName = clientName.Trim();
        Title = title.Trim(); ContractValue = contractValue; StartDate = startDate; EndDate = endDate;
        Contractor = contractor?.Trim(); Notes = notes?.Trim(); Status = "draft";
        CreatedAt = DateTime.UtcNow;
    }
    public Guid     Id             { get; private set; }
    public string   ContractNumber { get; private set; } = string.Empty;
    public Guid?    DealId         { get; private set; }
    public Guid?    CustomerId     { get; private set; }
    public Guid?    EstimateId     { get; private set; }
    public Guid?    ProjectId      { get; private set; }
    public string   ClientName     { get; private set; } = string.Empty;
    public string   Title          { get; private set; } = string.Empty;
    public decimal  ContractValue  { get; private set; }
    public string   StartDate      { get; private set; } = string.Empty;
    public string   EndDate        { get; private set; } = string.Empty;
    public string   Status         { get; private set; } = "draft"; // draft | active | completed | terminated
    public string?  Contractor     { get; private set; }
    public string?  Notes          { get; private set; }
    public bool     IsDeleted      { get; private set; }
    public DateTime CreatedAt      { get; private set; }
    public DateTime UpdatedAt      { get; private set; } = DateTime.UtcNow;

    public void LinkProject(Guid projectId) { ProjectId = projectId; UpdatedAt = DateTime.UtcNow; }
    public void SetStatus(string s) { Status = s; UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}
