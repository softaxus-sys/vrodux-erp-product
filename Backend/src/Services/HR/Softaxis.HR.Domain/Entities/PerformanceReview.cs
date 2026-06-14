namespace Softaxis.HR.Domain.Entities;

public sealed class PerformanceReview
{
    private PerformanceReview() { }

    public PerformanceReview(
        Guid    employeeId,
        string  employeeName,
        string? department,
        string? designation,
        string  reviewPeriod,
        string  reviewType,
        string  dueDate,
        string  reviewedBy)
    {
        Id           = Guid.NewGuid();
        EmployeeId   = employeeId;
        EmployeeName = employeeName.Trim();
        Department   = department?.Trim();
        Designation  = designation?.Trim();
        ReviewPeriod = reviewPeriod.Trim();
        ReviewType   = reviewType;     // annual | mid_year | probation | pip
        Status       = "pending";      // pending | in_progress | completed
        DueDate      = dueDate;
        ReviewedBy   = reviewedBy.Trim();
        CreatedAt    = DateTime.UtcNow;
    }

    public Guid      Id                  { get; private set; }
    public Guid      EmployeeId          { get; private set; }
    public string    EmployeeName        { get; private set; } = string.Empty;
    public string?   Department          { get; private set; }
    public string?   Designation         { get; private set; }
    public string    ReviewPeriod        { get; private set; } = string.Empty;
    public string    ReviewType          { get; private set; } = string.Empty;
    public string    Status              { get; private set; } = "pending";
    public int?      OverallRating       { get; private set; }
    public int?      TechnicalRating     { get; private set; }
    public int?      CommunicationRating { get; private set; }
    public int?      TeamworkRating      { get; private set; }
    public int?      LeadershipRating    { get; private set; }
    public string    ReviewedBy          { get; private set; } = string.Empty;
    public string    DueDate             { get; private set; } = string.Empty;
    public string?   CompletedDate       { get; private set; }
    public string?   Strengths           { get; private set; }
    public string?   Improvements        { get; private set; }
    public DateTime  CreatedAt           { get; private set; }
    public DateTime? UpdatedAt           { get; private set; }
    public bool      IsDeleted           { get; private set; }

    public ICollection<PerformanceGoal> Goals { get; private set; } = new List<PerformanceGoal>();

    public void Update(string reviewPeriod, string reviewType, string dueDate, string reviewedBy)
    {
        ReviewPeriod = reviewPeriod.Trim();
        ReviewType   = reviewType;
        DueDate      = dueDate;
        ReviewedBy   = reviewedBy.Trim();
        UpdatedAt    = DateTime.UtcNow;
    }

    public void Start()
    {
        if (Status == "pending")
            Status = "in_progress";
        UpdatedAt = DateTime.UtcNow;
    }

    public void Complete(
        int?    overallRating,
        int?    technicalRating,
        int?    communicationRating,
        int?    teamworkRating,
        int?    leadershipRating,
        string? strengths,
        string? improvements)
    {
        OverallRating       = overallRating;
        TechnicalRating     = technicalRating;
        CommunicationRating = communicationRating;
        TeamworkRating      = teamworkRating;
        LeadershipRating    = leadershipRating;
        Strengths           = strengths?.Trim();
        Improvements        = improvements?.Trim();
        Status              = "completed";
        CompletedDate       = DateTime.UtcNow.ToString("yyyy-MM-dd");
        UpdatedAt           = DateTime.UtcNow;
    }

    public void AddGoal(PerformanceGoal goal)
    {
        Goals.Add(goal);
        UpdatedAt = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

public sealed class PerformanceGoal
{
    private PerformanceGoal() { }

    public PerformanceGoal(Guid performanceReviewId, string title, string target, string dueDate)
    {
        Id                  = Guid.NewGuid();
        PerformanceReviewId = performanceReviewId;
        Title               = title.Trim();
        Target              = target.Trim();
        DueDate             = dueDate;
        Progress            = 0;
        Status              = "on_track"; // on_track | at_risk | achieved | missed
    }

    public Guid    Id                  { get; private set; }
    public Guid    PerformanceReviewId { get; private set; }
    public string  Title               { get; private set; } = string.Empty;
    public string  Target              { get; private set; } = string.Empty;
    public int     Progress            { get; private set; }
    public string  Status              { get; private set; } = "on_track";
    public string  DueDate             { get; private set; } = string.Empty;

    public PerformanceReview? PerformanceReview { get; private set; }

    public void UpdateProgress(int progress, string status)
    {
        Progress = Math.Clamp(progress, 0, 100);
        Status   = status;
    }

    public void Update(string title, string target, string dueDate)
    {
        Title   = title.Trim();
        Target  = target.Trim();
        DueDate = dueDate;
    }
}
