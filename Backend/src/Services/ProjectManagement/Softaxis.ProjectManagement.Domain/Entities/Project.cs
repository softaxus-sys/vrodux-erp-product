namespace Softaxis.ProjectManagement.Domain.Entities;

public sealed class Project
{
    private Project() { }

    public Project(string key, string name, string? description, string? leadName)
    {
        Id              = Guid.NewGuid();
        Key             = key.Trim().ToUpperInvariant();
        Name            = name.Trim();
        Description     = description?.Trim();
        LeadName        = leadName?.Trim();
        Status          = "active";
        NextIssueNumber = 1;
        CreatedAt       = DateTime.UtcNow;
    }

    public Guid     Id              { get; private set; }
    public string   Key             { get; private set; } = string.Empty;
    public string   Name            { get; private set; } = string.Empty;
    public string?  Description     { get; private set; }
    public string   Status          { get; private set; } = "active"; // active | archived
    public string?  LeadName        { get; private set; }
    public int      NextIssueNumber { get; private set; } = 1;
    public DateTime  CreatedAt      { get; private set; }
    public DateTime? UpdatedAt      { get; private set; }
    public bool      IsDeleted      { get; private set; }

    public ICollection<BoardColumn>   BoardColumns { get; private set; } = new List<BoardColumn>();
    public ICollection<Label>         Labels       { get; private set; } = new List<Label>();
    public ICollection<Sprint>        Sprints      { get; private set; } = new List<Sprint>();
    public ICollection<Issue>         Issues       { get; private set; } = new List<Issue>();
    public ICollection<ProjectMember> Members      { get; private set; } = new List<ProjectMember>();

    public void Rename(string name)
    {
        Name      = name.Trim();
        UpdatedAt = DateTime.UtcNow;
    }

    public void UpdateDescription(string? description)
    {
        Description = description?.Trim();
        UpdatedAt    = DateTime.UtcNow;
    }

    public void SetLead(string? leadName)
    {
        LeadName  = leadName?.Trim();
        UpdatedAt = DateTime.UtcNow;
    }

    public void Archive()
    {
        Status    = "archived";
        UpdatedAt = DateTime.UtcNow;
    }

    public void Activate()
    {
        Status    = "active";
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Allocates and returns the next issue key (e.g. "ENG-12"), advancing the counter.</summary>
    public string NextIssueKey()
    {
        var key = $"{Key}-{NextIssueNumber}";
        NextIssueNumber++;
        UpdatedAt = DateTime.UtcNow;
        return key;
    }
}
