namespace Softaxis.RealEstate.Domain.Entities;

public sealed class LeaseContract
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public string ContractNumber { get; private set; } = null!;
    public Guid PropertyId { get; private set; }
    public string PropertyName { get; private set; } = null!;
    public Guid UnitId { get; private set; }
    public string UnitNumber { get; private set; } = null!;
    public Guid TenantId { get; private set; }
    public string TenantName { get; private set; } = null!;
    public string StartDate { get; private set; } = null!;
    public string EndDate { get; private set; } = null!;
    public decimal AnnualRent { get; private set; }
    public int Cheques { get; private set; }
    public decimal SecurityDeposit { get; private set; }
    public string Status { get; private set; } = "active"; // active/expired/terminated/renewed
    public decimal TotalPaid { get; private set; }
    public string? EjariNumber { get; private set; }
    public string? Notes { get; private set; }
    public bool IsDeleted { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; private set; } = DateTime.UtcNow;

    // computed — not mapped
    public decimal Balance => AnnualRent - TotalPaid;

    public LeaseContract(Guid propertyId, string propertyName, Guid unitId, string unitNumber,
        Guid tenantId, string tenantName, string startDate, string endDate,
        decimal annualRent, int cheques, decimal securityDeposit, string? ejariNumber, string? notes)
    {
        ContractNumber = $"LC-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..4].ToUpper()}";
        PropertyId = propertyId; PropertyName = propertyName; UnitId = unitId; UnitNumber = unitNumber;
        TenantId = tenantId; TenantName = tenantName; StartDate = startDate; EndDate = endDate;
        AnnualRent = annualRent; Cheques = cheques; SecurityDeposit = securityDeposit;
        EjariNumber = ejariNumber; Notes = notes;
    }

    public void RecordPayment(decimal amount) { TotalPaid += amount; UpdatedAt = DateTime.UtcNow; }
    public void Terminate() { Status = "terminated"; UpdatedAt = DateTime.UtcNow; }
    public void Expire() { Status = "expired"; UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}
