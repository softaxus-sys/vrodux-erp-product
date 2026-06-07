namespace Softaxis.CRM.Domain.Entities;

public sealed class Lead
{
    private Lead() { }
    public Lead(string firstName, string lastName, string title, string company, string industry,
        string email, string phone, string country, string city, string source, string priority,
        decimal estimatedValue, string assignedTo, string? notes)
    {
        Id             = Guid.NewGuid();
        FirstName      = firstName.Trim(); LastName = lastName.Trim();
        Title          = title.Trim(); Company = company.Trim(); Industry = industry.Trim();
        Email          = email.Trim().ToLowerInvariant(); Phone = phone.Trim();
        Country        = country; City = city; Source = source; Priority = priority;
        Status         = "new"; Score = 0; EstimatedValue = estimatedValue;
        Currency       = "AED"; AssignedTo = assignedTo.Trim();
        CreatedDate    = DateTime.UtcNow.ToString("yyyy-MM-dd");
        Notes          = notes?.Trim(); Tags = [];
        CreatedAt      = DateTime.UtcNow;
    }
    public Guid      Id              { get; private set; }
    public string    FirstName       { get; private set; } = string.Empty;
    public string    LastName        { get; private set; } = string.Empty;
    public string    FullName        => $"{FirstName} {LastName}";
    public string    Title           { get; private set; } = string.Empty;
    public string    Company         { get; private set; } = string.Empty;
    public string    Industry        { get; private set; } = string.Empty;
    public string    Email           { get; private set; } = string.Empty;
    public string    Phone           { get; private set; } = string.Empty;
    public string    Country         { get; private set; } = string.Empty;
    public string    City            { get; private set; } = string.Empty;
    public string    Source          { get; private set; } = string.Empty;
    public string    Status          { get; private set; } = "new";
    public string    Priority        { get; private set; } = "medium";
    public int       Score           { get; private set; }
    public decimal   EstimatedValue  { get; private set; }
    public string    Currency        { get; private set; } = "AED";
    public string    AssignedTo      { get; private set; } = string.Empty;
    public string    CreatedDate     { get; private set; } = string.Empty;
    public string?   LastContactDate { get; private set; }
    public string?   NextFollowUp    { get; private set; }
    public string?   Notes           { get; private set; }
    public string?   ConvertedDealId { get; private set; }
    public List<string> Tags         { get; private set; } = [];
    public bool      IsDeleted       { get; private set; }
    public DateTime  CreatedAt       { get; private set; }
    public DateTime? UpdatedAt       { get; private set; }
    public void UpdateStatus(string status) { Status = status; UpdatedAt = DateTime.UtcNow; }
    public void UpdateScore(int score) { Score = Math.Clamp(score, 0, 100); UpdatedAt = DateTime.UtcNow; }
    public void Convert(string dealId) { Status = "converted"; ConvertedDealId = dealId; UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }

    public void Update(string firstName, string lastName, string title, string company, string industry,
        string email, string phone, string country, string city, string source, string priority,
        decimal estimatedValue, string assignedTo, int score, string? nextFollowUp, string? notes, List<string>? tags)
    {
        FirstName = firstName.Trim(); LastName = lastName.Trim();
        Title = title.Trim(); Company = company.Trim(); Industry = industry.Trim();
        Email = email.Trim().ToLowerInvariant(); Phone = phone.Trim();
        Country = country; City = city; Source = source; Priority = priority;
        EstimatedValue = estimatedValue; AssignedTo = assignedTo.Trim();
        Score = Math.Clamp(score, 0, 100); NextFollowUp = nextFollowUp; Notes = notes?.Trim();
        if (tags is not null) Tags = tags;
        UpdatedAt = DateTime.UtcNow;
    }
}
