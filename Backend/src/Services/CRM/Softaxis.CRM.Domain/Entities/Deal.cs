namespace Softaxis.CRM.Domain.Entities;

public sealed class Deal
{
    private Deal() { }
    public Deal(string title, string company, decimal value, string stage, string priority,
        int probability, string expectedCloseDate, string assignedTo, string source,
        string industry, string description)
    {
        Id               = Guid.NewGuid();
        Title            = title.Trim(); Company = company.Trim();
        Value            = value; Currency = "AED"; Stage = stage; Priority = priority;
        Probability      = probability; ExpectedCloseDate = expectedCloseDate;
        CreatedDate      = DateTime.UtcNow.ToString("yyyy-MM-dd");
        AssignedTo       = assignedTo.Trim(); Source = source;
        Industry         = industry; Description = description.Trim();
        Tags             = []; CreatedAt = DateTime.UtcNow;
    }
    public Guid      Id               { get; private set; }
    public string    Title            { get; private set; } = string.Empty;
    public string    Company          { get; private set; } = string.Empty;
    public decimal   Value            { get; private set; }
    public string    Currency         { get; private set; } = "AED";
    public string    Stage            { get; private set; } = "lead";
    public string    Priority         { get; private set; } = "medium";
    public int       Probability      { get; private set; }
    public string    ExpectedCloseDate{ get; private set; } = string.Empty;
    public string    CreatedDate      { get; private set; } = string.Empty;
    public string    AssignedTo       { get; private set; } = string.Empty;
    public string    Source           { get; private set; } = string.Empty;
    public string    Industry         { get; private set; } = string.Empty;
    public string    Description      { get; private set; } = string.Empty;
    public string?   NextAction       { get; private set; }
    public string?   NextActionDate   { get; private set; }
    public List<string> Tags          { get; private set; } = [];
    // Contact stored as JSON
    public string    ContactJson      { get; private set; } = "{}";
    public bool      IsDeleted        { get; private set; }
    public DateTime  CreatedAt        { get; private set; }
    public DateTime? UpdatedAt        { get; private set; }
    public void MoveStage(string stage, int probability) { Stage = stage; Probability = probability; UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }

    public void Update(string title, string company, decimal value, string stage, string priority,
        int probability, string expectedCloseDate, string assignedTo, string source, string industry,
        string description, string? nextAction, string? nextActionDate, List<string>? tags)
    {
        Title = title.Trim(); Company = company.Trim(); Value = value;
        Stage = stage; Priority = priority; Probability = probability;
        ExpectedCloseDate = expectedCloseDate; AssignedTo = assignedTo.Trim();
        Source = source; Industry = industry; Description = description.Trim();
        NextAction = nextAction; NextActionDate = nextActionDate;
        if (tags is not null) Tags = tags;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetNextAction(string? action, string? date) { NextAction = action; NextActionDate = date; UpdatedAt = DateTime.UtcNow; }
}
