namespace Softaxis.Construction.Domain.Entities;

public sealed class Site
{
    private Site() { }
    public Site(string name, string projectId, string projectName, string address, string city,
        string emirate, string siteManager, string safetyOfficer, string permitNumber, string permitExpiry, int maxWorkers)
    {
        Id               = Guid.NewGuid();
        SiteCode         = $"SITE-{Guid.NewGuid().ToString()[..8].ToUpper()}";
        Name             = name.Trim(); ProjectId = projectId; ProjectName = projectName.Trim();
        Address          = address.Trim(); City = city; Emirate = emirate;
        Lat              = "0"; Lng = "0";
        SiteManager      = siteManager.Trim(); SiteManagerPhone = "";
        SafetyOfficer    = safetyOfficer.Trim(); SafetyOfficerPhone = "";
        Status           = "active"; CurrentWorkers = 0; MaxWorkers = maxWorkers;
        PermitNumber     = permitNumber; PermitExpiry = permitExpiry;
        SafetyScore      = 90; Area = 0;
        LastInspection   = DateTime.UtcNow.AddDays(-30).ToString("yyyy-MM-dd");
        NextInspection   = DateTime.UtcNow.AddDays(60).ToString("yyyy-MM-dd");
        StartDate        = DateTime.UtcNow.ToString("yyyy-MM-dd"); Notes = "";
        CreatedAt        = DateTime.UtcNow;
    }
    public Guid      Id                { get; private set; }
    public string    SiteCode          { get; private set; } = string.Empty;
    public string    Name              { get; private set; } = string.Empty;
    public string    ProjectId         { get; private set; } = string.Empty;
    public string    ProjectName       { get; private set; } = string.Empty;
    public string    Address           { get; private set; } = string.Empty;
    public string    City              { get; private set; } = string.Empty;
    public string    Emirate           { get; private set; } = string.Empty;
    public string    Lat               { get; private set; } = "0";
    public string    Lng               { get; private set; } = "0";
    public string    SiteManager       { get; private set; } = string.Empty;
    public string    SiteManagerPhone  { get; private set; } = string.Empty;
    public string    SafetyOfficer     { get; private set; } = string.Empty;
    public string    SafetyOfficerPhone{ get; private set; } = string.Empty;
    public string    Status            { get; private set; } = "active";
    public int       CurrentWorkers    { get; private set; }
    public int       MaxWorkers        { get; private set; }
    public decimal   Area              { get; private set; }
    public string    StartDate         { get; private set; } = string.Empty;
    public string    PermitNumber      { get; private set; } = string.Empty;
    public string    PermitExpiry      { get; private set; } = string.Empty;
    public string    LastInspection    { get; private set; } = string.Empty;
    public string    NextInspection    { get; private set; } = string.Empty;
    public int       SafetyScore       { get; private set; }
    public string    Notes             { get; private set; } = string.Empty;
    public bool      IsDeleted         { get; private set; }
    public DateTime  CreatedAt         { get; private set; }
    public DateTime? UpdatedAt         { get; private set; }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}
