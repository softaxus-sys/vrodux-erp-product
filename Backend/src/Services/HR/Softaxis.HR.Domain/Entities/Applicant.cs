namespace Softaxis.HR.Domain.Entities;

public sealed class Applicant
{
    private Applicant() { }

    public Applicant(
        Guid    jobPostingId,
        string  jobTitle,
        string  name,
        string  email,
        string? phone,
        string? nationality,
        string? currentRole,
        string? currentCompany,
        int     experienceYears,
        string? source,
        string? notes)
    {
        Id              = Guid.NewGuid();
        JobPostingId    = jobPostingId;
        JobTitle        = jobTitle.Trim();
        Name            = name.Trim();
        Email           = email.Trim().ToLowerInvariant();
        Phone           = phone?.Trim();
        Nationality     = nationality?.Trim();
        CurrentRole     = currentRole?.Trim();
        CurrentCompany  = currentCompany?.Trim();
        ExperienceYears = experienceYears;
        Stage           = "applied";
        AppliedDate     = DateTime.UtcNow.ToString("yyyy-MM-dd");
        Source          = source?.Trim();
        Notes           = notes?.Trim();
        CreatedAt       = DateTime.UtcNow;
    }

    public Guid      Id              { get; private set; }
    public Guid      JobPostingId    { get; private set; }
    public string    JobTitle        { get; private set; } = string.Empty;
    public string    Name            { get; private set; } = string.Empty;
    public string    Email           { get; private set; } = string.Empty;
    public string?   Phone           { get; private set; }
    public string?   Nationality     { get; private set; }
    public string?   CurrentRole     { get; private set; }
    public string?   CurrentCompany  { get; private set; }
    public int       ExperienceYears { get; private set; }
    public string    Stage           { get; private set; } = "applied";
    public string    AppliedDate     { get; private set; } = string.Empty;
    public int?      Rating          { get; private set; }
    public string?   Notes           { get; private set; }
    public string?   Source          { get; private set; }
    public string?   ResumeFileName    { get; private set; }
    public string?   ResumeStoragePath { get; private set; }
    public DateTime  CreatedAt       { get; private set; }
    public DateTime? UpdatedAt       { get; private set; }
    public bool      IsDeleted       { get; private set; }

    public JobPosting? JobPosting { get; private set; }

    private static readonly string[] StageOrder =
        ["applied", "screening", "interview", "offer", "hired", "rejected"];

    public void SetStage(string stage)
    {
        Stage     = stage;
        UpdatedAt = DateTime.UtcNow;
    }

    public string? NextStage()
    {
        var idx = Array.IndexOf(StageOrder, Stage);
        if (idx < 0 || idx >= StageOrder.Length - 2) return null; // "rejected" excluded, "hired" is final
        return StageOrder[idx + 1];
    }

    public void SetRating(int? rating)
    {
        Rating    = rating;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Update(string? notes)
    {
        Notes     = notes?.Trim();
        UpdatedAt = DateTime.UtcNow;
    }

    public void AttachResume(string fileName, string storagePath)
    {
        ResumeFileName    = fileName;
        ResumeStoragePath = storagePath;
        UpdatedAt         = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}
