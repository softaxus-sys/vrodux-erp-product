namespace Softaxis.RealEstate.Domain.Entities;

public sealed class Broker
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public string BrokerNumber { get; private set; } = null!;
    public string Name { get; private set; } = null!;
    public string Agency { get; private set; } = null!;
    public string Email { get; private set; } = null!;
    public string Phone { get; private set; } = null!;
    public string LicenseNumber { get; private set; } = null!;
    public string LicenseExpiry { get; private set; } = null!;
    public string Specialization { get; private set; } = null!; // residential/commercial/both
    public int DealsCompleted { get; private set; }
    public decimal TotalCommission { get; private set; }
    public decimal CommissionRate { get; private set; } // percentage
    public decimal Rating { get; private set; } = 5.0m;
    public string Status { get; private set; } = "active";
    public bool IsDeleted { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; private set; } = DateTime.UtcNow;

    public Broker(string name, string agency, string email, string phone,
        string licenseNumber, string licenseExpiry, string specialization, decimal commissionRate)
    {
        BrokerNumber = $"BRK-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..4].ToUpper()}";
        Name = name; Agency = agency; Email = email; Phone = phone;
        LicenseNumber = licenseNumber; LicenseExpiry = licenseExpiry;
        Specialization = specialization; CommissionRate = commissionRate;
    }

    public void RecordDeal(decimal commission)
    {
        DealsCompleted++; TotalCommission += commission; UpdatedAt = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}
