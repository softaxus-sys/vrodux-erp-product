namespace Softaxis.CRM.Domain.Entities;

// ── Insurance pack ───────────────────────────────────────────────────────────
// Lead → Policy Proposal → Policy Issuance → Renewal → Claims.
// Policy holders are CRM customers; opportunities are CRM deals. `insurance` schema.

public sealed class Policy
{
    private Policy() { }
    public Policy(Guid? leadId, Guid? dealId, Guid? customerId, string holderName, string productType,
        decimal premium, decimal sumInsured, string startDate, string endDate, string? agent, string? notes)
    {
        Id = Guid.NewGuid();
        PolicyNumber = $"POL-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..5].ToUpper()}";
        LeadId = leadId; DealId = dealId; CustomerId = customerId; HolderName = holderName.Trim();
        ProductType = productType.Trim(); Premium = premium; SumInsured = sumInsured;
        StartDate = startDate; EndDate = endDate; Agent = agent?.Trim(); Notes = notes?.Trim();
        Status = "proposal"; CreatedAt = DateTime.UtcNow;
    }
    public Guid     Id           { get; private set; }
    public string   PolicyNumber { get; private set; } = string.Empty;
    public Guid?    LeadId       { get; private set; }
    public Guid?    DealId       { get; private set; }
    public Guid?    CustomerId   { get; private set; }
    public string   HolderName   { get; private set; } = string.Empty;
    public string   ProductType  { get; private set; } = string.Empty; // life | health | motor | property | travel
    public decimal  Premium      { get; private set; }
    public decimal  SumInsured   { get; private set; }
    public string   StartDate    { get; private set; } = string.Empty;
    public string   EndDate      { get; private set; } = string.Empty;
    public string   Status       { get; private set; } = "proposal"; // proposal | issued | renewed | lapsed | cancelled
    public string?  Agent        { get; private set; }
    public string?  Notes        { get; private set; }
    public bool     IsDeleted    { get; private set; }
    public DateTime CreatedAt    { get; private set; }
    public DateTime UpdatedAt    { get; private set; } = DateTime.UtcNow;

    public void SetStatus(string s) { Status = s; UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

public sealed class PolicyRenewal
{
    private PolicyRenewal() { }
    public PolicyRenewal(Guid policyId, string policyNumber, string holderName, string renewalDate, decimal newPremium, string? notes)
    {
        Id = Guid.NewGuid();
        PolicyId = policyId; PolicyNumber = policyNumber; HolderName = holderName.Trim();
        RenewalDate = renewalDate; NewPremium = newPremium; Notes = notes?.Trim();
        Status = "due"; CreatedAt = DateTime.UtcNow;
    }
    public Guid     Id           { get; private set; }
    public Guid     PolicyId     { get; private set; }
    public string   PolicyNumber { get; private set; } = string.Empty;
    public string   HolderName   { get; private set; } = string.Empty;
    public string   RenewalDate  { get; private set; } = string.Empty;
    public decimal  NewPremium   { get; private set; }
    public string   Status       { get; private set; } = "due"; // due | renewed | lapsed
    public string?  Notes        { get; private set; }
    public bool     IsDeleted    { get; private set; }
    public DateTime CreatedAt    { get; private set; }
    public DateTime UpdatedAt    { get; private set; } = DateTime.UtcNow;

    public void SetStatus(string s) { Status = s; UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

public sealed class InsuranceClaim
{
    private InsuranceClaim() { }
    public InsuranceClaim(Guid policyId, string policyNumber, Guid? customerId, string holderName,
        string claimDate, decimal claimAmount, string? reason, string? notes)
    {
        Id = Guid.NewGuid();
        ClaimNumber = $"CLM-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..5].ToUpper()}";
        PolicyId = policyId; PolicyNumber = policyNumber; CustomerId = customerId; HolderName = holderName.Trim();
        ClaimDate = claimDate; ClaimAmount = claimAmount; Reason = reason?.Trim(); Notes = notes?.Trim();
        Status = "filed"; ApprovedAmount = 0; CreatedAt = DateTime.UtcNow;
    }
    public Guid     Id             { get; private set; }
    public string   ClaimNumber    { get; private set; } = string.Empty;
    public Guid     PolicyId       { get; private set; }
    public string   PolicyNumber   { get; private set; } = string.Empty;
    public Guid?    CustomerId     { get; private set; }
    public string   HolderName     { get; private set; } = string.Empty;
    public string   ClaimDate      { get; private set; } = string.Empty;
    public decimal  ClaimAmount    { get; private set; }
    public decimal  ApprovedAmount { get; private set; }
    public string   Status         { get; private set; } = "filed"; // filed | under_review | approved | rejected | paid
    public string?  Reason         { get; private set; }
    public string?  Notes          { get; private set; }
    public bool     IsDeleted      { get; private set; }
    public DateTime CreatedAt      { get; private set; }
    public DateTime UpdatedAt      { get; private set; } = DateTime.UtcNow;

    public void Approve(decimal amount) { ApprovedAmount = amount; Status = "approved"; UpdatedAt = DateTime.UtcNow; }
    public void SetStatus(string s) { Status = s; UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}
