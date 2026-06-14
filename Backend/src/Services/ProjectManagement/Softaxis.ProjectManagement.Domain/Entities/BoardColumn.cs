namespace Softaxis.ProjectManagement.Domain.Entities;

public sealed class BoardColumn
{
    private BoardColumn() { }

    public BoardColumn(Guid projectId, string name, string category, int sortOrder, bool isDefault = false)
    {
        Id        = Guid.NewGuid();
        ProjectId = projectId;
        Name      = name.Trim();
        Category  = category;
        SortOrder = sortOrder;
        IsDefault = isDefault;
        CreatedAt = DateTime.UtcNow;
    }

    public Guid     Id        { get; private set; }
    public Guid     ProjectId { get; private set; }
    public string   Name      { get; private set; } = string.Empty;
    public string   Category  { get; private set; } = "todo"; // backlog | todo | in_progress | done
    public int      SortOrder { get; private set; }
    public bool     IsDefault { get; private set; }
    public DateTime  CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }
    public bool      IsDeleted { get; private set; }

    public Project? Project { get; private set; }
    public ICollection<Issue> Issues { get; private set; } = new List<Issue>();

    public void Rename(string name)
    {
        Name      = name.Trim();
        UpdatedAt = DateTime.UtcNow;
    }

    public void Reorder(int sortOrder)
    {
        SortOrder = sortOrder;
        UpdatedAt = DateTime.UtcNow;
    }
}
