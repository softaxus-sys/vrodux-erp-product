namespace Softaxis.CRM.Domain.Entities;

// ── B2B Services pack ────────────────────────────────────────────────────────
// Lead → Discovery → Proposal → Contract → Project → Support → Renewal.
// For IT/SaaS/Consulting/Agencies. Lives in the `b2b` schema.

public sealed class Proposal
{
    private Proposal() { }
    public Proposal(Guid? leadId, Guid? dealId, Guid? customerId, string clientName, string title,
        decimal amount, string validUntil, string? scope, string? notes)
    {
        Id = Guid.NewGuid();
        ProposalNumber = $"PRO-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..5].ToUpper()}";
        LeadId = leadId; DealId = dealId; CustomerId = customerId; ClientName = clientName.Trim();
        Title = title.Trim(); Amount = amount; ValidUntil = validUntil; Scope = scope?.Trim(); Notes = notes?.Trim();
        Status = "draft"; CreatedAt = DateTime.UtcNow;
    }
    public Guid     Id             { get; private set; }
    public string   ProposalNumber { get; private set; } = string.Empty;
    public Guid?    LeadId         { get; private set; }
    public Guid?    DealId         { get; private set; }
    public Guid?    CustomerId     { get; private set; }
    public string   ClientName     { get; private set; } = string.Empty;
    public string   Title          { get; private set; } = string.Empty;
    public decimal  Amount         { get; private set; }
    public string   ValidUntil     { get; private set; } = string.Empty;
    public string   Status         { get; private set; } = "draft"; // draft | sent | accepted | rejected
    public string?  Scope          { get; private set; }
    public string?  Notes          { get; private set; }
    public bool     IsDeleted      { get; private set; }
    public DateTime CreatedAt      { get; private set; }
    public DateTime UpdatedAt      { get; private set; } = DateTime.UtcNow;

    public void SetStatus(string s) { Status = s; UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

public sealed class ServiceContract
{
    private ServiceContract() { }
    public ServiceContract(Guid? proposalId, Guid? dealId, Guid? customerId, string clientName, string title,
        string contractType, decimal value, string startDate, string endDate, string? slaTier, string? notes)
    {
        Id = Guid.NewGuid();
        ContractNumber = $"SVC-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..5].ToUpper()}";
        ProposalId = proposalId; DealId = dealId; CustomerId = customerId; ClientName = clientName.Trim();
        Title = title.Trim(); ContractType = contractType; Value = value;
        StartDate = startDate; EndDate = endDate; SlaTier = slaTier; Notes = notes?.Trim();
        Status = "active"; CreatedAt = DateTime.UtcNow;
    }
    public Guid     Id             { get; private set; }
    public string   ContractNumber { get; private set; } = string.Empty;
    public Guid?    ProposalId     { get; private set; }
    public Guid?    DealId         { get; private set; }
    public Guid?    CustomerId     { get; private set; }
    public string   ClientName     { get; private set; } = string.Empty;
    public string   Title          { get; private set; } = string.Empty;
    public string   ContractType   { get; private set; } = "project"; // project | amc | retainer | sla
    public decimal  Value          { get; private set; }
    public string   StartDate      { get; private set; } = string.Empty;
    public string   EndDate        { get; private set; } = string.Empty;
    public string   Status         { get; private set; } = "active"; // active | completed | renewed | terminated
    public string?  SlaTier        { get; private set; }              // bronze | silver | gold | platinum
    public string?  Notes          { get; private set; }
    public bool     IsDeleted      { get; private set; }
    public DateTime CreatedAt      { get; private set; }
    public DateTime UpdatedAt      { get; private set; } = DateTime.UtcNow;

    public void SetStatus(string s) { Status = s; UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

public sealed class SupportTicket
{
    private SupportTicket() { }
    public SupportTicket(Guid? contractId, Guid? customerId, string clientName, string subject,
        string priority, string? description)
    {
        Id = Guid.NewGuid();
        TicketNumber = $"TKT-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..5].ToUpper()}";
        ContractId = contractId; CustomerId = customerId; ClientName = clientName.Trim();
        Subject = subject.Trim(); Priority = priority; Description = description?.Trim();
        Status = "open"; CreatedAt = DateTime.UtcNow;
    }
    public Guid     Id           { get; private set; }
    public string   TicketNumber { get; private set; } = string.Empty;
    public Guid?    ContractId   { get; private set; }
    public Guid?    CustomerId   { get; private set; }
    public string   ClientName   { get; private set; } = string.Empty;
    public string   Subject      { get; private set; } = string.Empty;
    public string   Priority     { get; private set; } = "medium"; // low | medium | high | critical
    public string   Status       { get; private set; } = "open";   // open | in_progress | resolved | closed
    public string?  Description  { get; private set; }
    public string?  Resolution   { get; private set; }
    public bool     IsDeleted    { get; private set; }
    public DateTime CreatedAt    { get; private set; }
    public DateTime UpdatedAt    { get; private set; } = DateTime.UtcNow;

    public void Resolve(string? resolution) { Resolution = resolution?.Trim(); Status = "resolved"; UpdatedAt = DateTime.UtcNow; }
    public void SetStatus(string s) { Status = s; UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}
