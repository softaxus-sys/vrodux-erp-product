namespace Softaxis.ProjectManagement.Domain.Entities;

public sealed class Sprint
{
    private Sprint() { }

    public Sprint(Guid projectId, string name, string? goal, string? startDate, string? endDate, int sortOrder)
    {
        Id        = Guid.NewGuid();
        ProjectId = projectId;
        Name      = name.Trim();
        Goal      = goal?.Trim();
        StartDate = startDate;
        EndDate   = endDate;
        Status    = "planned";
        SortOrder = sortOrder;
        CreatedAt = DateTime.UtcNow;
    }

    public Guid     Id        { get; private set; }
    public Guid     ProjectId { get; private set; }
    public string   Name      { get; private set; } = string.Empty;
    public string?  Goal      { get; private set; }
    public string?  StartDate { get; private set; }
    public string?  EndDate   { get; private set; }
    public string   Status    { get; private set; } = "planned"; // planned | active | completed
    public int      SortOrder { get; private set; }
    public DateTime  CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }
    public bool      IsDeleted { get; private set; }

    public Project? Project { get; private set; }
    public ICollection<Issue> Issues { get; private set; } = new List<Issue>();

    public void UpdateDetails(string name, string? goal, string? startDate, string? endDate)
    {
        Name      = name.Trim();
        Goal      = goal?.Trim();
        StartDate = startDate;
        EndDate   = endDate;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Start()
    {
        Status    = "active";
        UpdatedAt = DateTime.UtcNow;
    }

    public void Complete()
    {
        Status    = "completed";
        UpdatedAt = DateTime.UtcNow;
    }
}
