namespace Softaxis.Construction.Domain.Entities;

public sealed class Contractor
{
    private Contractor() { }
    public Contractor(string companyName, string tradeName, string contactPerson, string email,
        string phone, string city, string licenseNumber, string licenseExpiry)
    {
        Id               = Guid.NewGuid();
        ContractorCode   = $"CON-{Guid.NewGuid().ToString()[..8].ToUpper()}";
        CompanyName      = companyName.Trim(); TradeName = tradeName.Trim();
        Trade            = "civil"; Status = "active"; Rating = 4.0m;
        ContactPerson    = contactPerson.Trim(); Email = email.Trim().ToLowerInvariant(); Phone = phone.Trim();
        City             = city; Country = "UAE";
        LicenseNumber    = licenseNumber; LicenseExpiry = licenseExpiry;
        InsuranceProvider = ""; InsuranceExpiry = ""; InsuranceCovered = "";
        ActiveProjects   = 0; CompletedProjects = 0; TotalContractValue = 0m; Notes = "";
        CreatedAt        = DateTime.UtcNow;
    }
    public Guid      Id                 { get; private set; }
    public string    ContractorCode     { get; private set; } = string.Empty;
    public string    CompanyName        { get; private set; } = string.Empty;
    public string    TradeName          { get; private set; } = string.Empty;
    public string    Trade              { get; private set; } = "civil";
    public string    Status             { get; private set; } = "active";
    public decimal   Rating             { get; private set; }
    public string    ContactPerson      { get; private set; } = string.Empty;
    public string    Email              { get; private set; } = string.Empty;
    public string    Phone              { get; private set; } = string.Empty;
    public string    City               { get; private set; } = string.Empty;
    public string    Country            { get; private set; } = "UAE";
    public string    LicenseNumber      { get; private set; } = string.Empty;
    public string    LicenseExpiry      { get; private set; } = string.Empty;
    public string    InsuranceProvider  { get; private set; } = string.Empty;
    public string    InsuranceExpiry    { get; private set; } = string.Empty;
    public string    InsuranceCovered   { get; private set; } = string.Empty;
    public int       ActiveProjects     { get; private set; }
    public int       CompletedProjects  { get; private set; }
    public decimal   TotalContractValue { get; private set; }
    public string    Notes              { get; private set; } = string.Empty;
    public bool      IsDeleted          { get; private set; }
    public DateTime  CreatedAt          { get; private set; }
    public DateTime? UpdatedAt          { get; private set; }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}
