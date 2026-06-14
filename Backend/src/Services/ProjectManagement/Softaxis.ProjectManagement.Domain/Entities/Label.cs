namespace Softaxis.ProjectManagement.Domain.Entities;

public sealed class Label
{
    private Label() { }

    public Label(Guid projectId, string name, string color)
    {
        Id        = Guid.NewGuid();
        ProjectId = projectId;
        Name      = name.Trim();
        Color     = color;
        CreatedAt = DateTime.UtcNow;
    }

    public Guid     Id        { get; private set; }
    public Guid     ProjectId { get; private set; }
    public string   Name      { get; private set; } = string.Empty;
    public string   Color     { get; private set; } = "#64748b";
    public DateTime  CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }
    public bool      IsDeleted { get; private set; }

    public Project? Project { get; private set; }
    public ICollection<IssueLabel> IssueLabels { get; private set; } = new List<IssueLabel>();

    public void Update(string name, string color)
    {
        Name      = name.Trim();
        Color     = color;
        UpdatedAt = DateTime.UtcNow;
    }
}
