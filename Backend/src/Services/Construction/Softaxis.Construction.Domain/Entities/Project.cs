namespace Softaxis.Construction.Domain.Entities;

public sealed class Project
{
    private Project() { }
    public Project(string name, string client, string location, string projectType,
        string startDate, string endDate, decimal contractValue, string projectManager, string siteEngineer, string? notes)
    {
        Id            = Guid.NewGuid();
        ProjectNumber = $"PRJ-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..6].ToUpper()}";
        Name          = name.Trim(); Client = client.Trim(); Location = location.Trim();
        ProjectType   = projectType; Status = "planning";
        StartDate     = startDate; EndDate = endDate; ContractValue = contractValue;
        BudgetSpent   = 0m; CompletionPct = 0; Workers = 0;
        ProjectManager = projectManager.Trim(); SiteEngineer = siteEngineer.Trim();
        Notes         = notes?.Trim(); Phases = []; CreatedAt = DateTime.UtcNow;
    }
    public Guid      Id             { get; private set; }
    public string    ProjectNumber  { get; private set; } = string.Empty;
    public string    Name           { get; private set; } = string.Empty;
    public string    Client         { get; private set; } = string.Empty;
    public string    Location       { get; private set; } = string.Empty;
    public string    ProjectType    { get; private set; } = string.Empty;
    public string    Status         { get; private set; } = "planning";
    public string    StartDate      { get; private set; } = string.Empty;
    public string    EndDate        { get; private set; } = string.Empty;
    public decimal   ContractValue  { get; private set; }
    public decimal   BudgetSpent    { get; private set; }
    public decimal   BudgetRemaining => ContractValue - BudgetSpent;
    public int       CompletionPct  { get; private set; }
    public string    ProjectManager { get; private set; } = string.Empty;
    public string    SiteEngineer   { get; private set; } = string.Empty;
    public int       Workers        { get; private set; }
    public string?   Notes          { get; private set; }
    public List<ProjectPhase> Phases { get; private set; } = [];
    public bool      IsDeleted      { get; private set; }
    public DateTime  CreatedAt      { get; private set; }
    public DateTime? UpdatedAt      { get; private set; }
    public void UpdateProgress(int pct, decimal spent, int workers, string status) { CompletionPct = pct; BudgetSpent = spent; Workers = workers; Status = status; UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

public sealed class ProjectPhase
{
    private ProjectPhase() { }
    public ProjectPhase(Guid projectId, string name, string startDate, string endDate)
    { Id = Guid.NewGuid(); ProjectId = projectId; Name = name.Trim(); StartDate = startDate; EndDate = endDate; Status = "not_started"; CompletionPct = 0; }
    public Guid     Id            { get; private set; }
    public Guid     ProjectId     { get; private set; }
    public string   Name          { get; private set; } = string.Empty;
    public string   StartDate     { get; private set; } = string.Empty;
    public string   EndDate       { get; private set; } = string.Empty;
    public string   Status        { get; private set; } = "not_started";
    public int      CompletionPct { get; private set; }
    public Project? Project       { get; private set; }
    public void Update(string status, int pct) { Status = status; CompletionPct = pct; }
}
