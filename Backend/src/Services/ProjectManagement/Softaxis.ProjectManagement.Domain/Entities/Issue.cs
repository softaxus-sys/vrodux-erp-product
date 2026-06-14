namespace Softaxis.ProjectManagement.Domain.Entities;

public sealed class Issue
{
    private Issue() { }

    public Issue(
        Guid projectId, string issueKey, string title, string? description,
        string type, string priority, Guid boardColumnId, string reporterName,
        Guid? assigneeId, string? assigneeName, Guid? epicId, Guid? sprintId,
        decimal? storyPoints, string? dueDate, int sortOrder)
    {
        Id             = Guid.NewGuid();
        ProjectId      = projectId;
        IssueKey       = issueKey;
        Title          = title.Trim();
        Description    = description?.Trim();
        Type           = type;
        Priority       = priority;
        BoardColumnId  = boardColumnId;
        ReporterName   = reporterName.Trim();
        AssigneeId     = assigneeId;
        AssigneeName   = assigneeName?.Trim();
        EpicId         = epicId;
        SprintId       = sprintId;
        StoryPoints    = storyPoints;
        DueDate        = dueDate;
        SortOrder      = sortOrder;
        CreatedAt      = DateTime.UtcNow;
    }

    public Guid     Id            { get; private set; }
    public Guid     ProjectId     { get; private set; }
    public string   IssueKey      { get; private set; } = string.Empty;
    public string   Title         { get; private set; } = string.Empty;
    public string?  Description   { get; private set; }
    public string   Type          { get; private set; } = "task"; // epic | story | task | bug
    public string   Priority      { get; private set; } = "medium"; // lowest | low | medium | high | highest
    public Guid     BoardColumnId { get; private set; }
    public Guid?    AssigneeId    { get; private set; }
    public string?  AssigneeName  { get; private set; }
    public string   ReporterName  { get; private set; } = string.Empty;
    public Guid?    EpicId        { get; private set; }
    public Guid?    SprintId      { get; private set; }
    public decimal? StoryPoints   { get; private set; }
    public string?  DueDate       { get; private set; }
    public int      SortOrder     { get; private set; }
    public DateTime? ResolvedAt   { get; private set; }
    public DateTime  CreatedAt    { get; private set; }
    public DateTime? UpdatedAt    { get; private set; }
    public bool      IsDeleted    { get; private set; }

    public Project?     Project     { get; private set; }
    public BoardColumn? BoardColumn { get; private set; }
    public Sprint?      Sprint      { get; private set; }
    public Issue?       Epic        { get; private set; }
    public ICollection<IssueLabel>   IssueLabels { get; private set; } = new List<IssueLabel>();
    public ICollection<IssueComment> Comments    { get; private set; } = new List<IssueComment>();

    public void UpdateDetails(
        string title, string? description, string type, string priority,
        string? assigneeName, Guid? assigneeId, Guid? epicId,
        decimal? storyPoints, string? dueDate)
    {
        Title        = title.Trim();
        Description  = description?.Trim();
        Type         = type;
        Priority     = priority;
        AssigneeName = assigneeName?.Trim();
        AssigneeId   = assigneeId;
        EpicId       = type == "epic" ? null : epicId;
        StoryPoints  = storyPoints;
        DueDate      = dueDate;
        UpdatedAt    = DateTime.UtcNow;
    }

    public void MoveToColumn(Guid boardColumnId, int sortOrder, bool isDoneColumn)
    {
        BoardColumnId = boardColumnId;
        SortOrder     = sortOrder;
        ResolvedAt    = isDoneColumn ? (ResolvedAt ?? DateTime.UtcNow) : null;
        UpdatedAt     = DateTime.UtcNow;
    }

    public void AssignTo(Guid? assigneeId, string? assigneeName)
    {
        AssigneeId   = assigneeId;
        AssigneeName = assigneeName?.Trim();
        UpdatedAt    = DateTime.UtcNow;
    }

    public void SetSprint(Guid? sprintId, int sortOrder)
    {
        SprintId  = sprintId;
        SortOrder = sortOrder;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetEpic(Guid? epicId)
    {
        EpicId    = Type == "epic" ? null : epicId;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetPriority(string priority)
    {
        Priority  = priority;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetStoryPoints(decimal? storyPoints)
    {
        StoryPoints = storyPoints;
        UpdatedAt   = DateTime.UtcNow;
    }

    public void Reorder(int sortOrder)
    {
        SortOrder = sortOrder;
        UpdatedAt = DateTime.UtcNow;
    }
}
