using Softaxis.BuildingBlocks.Domain.Multitenancy;

namespace Softaxis.HR.Domain.Entities;

public sealed class JobPosting
{
    private JobPosting() { }

    public JobPosting(
        string  title,
        string  department,
        string  branch,
        string  type,
        string  experienceLevel,
        int     headcount,
        decimal salaryMin,
        decimal salaryMax,
        string  currency,
        string? closingDate,
        string? hiringManager,
        string  description,
        string? requirementsText,
        string? responsibilitiesText,
        string  status)
    {
        Id                   = Guid.NewGuid();
        Title                = title.Trim();
        Department           = department.Trim();
        Branch               = branch.Trim();
        Type                 = type;
        ExperienceLevel      = experienceLevel;
        Headcount            = headcount;
        SalaryMin            = salaryMin;
        SalaryMax            = salaryMax;
        Currency             = currency;
        Status               = status;     // draft | open | on_hold | closed
        PostedDate           = DateTime.UtcNow.ToString("yyyy-MM-dd");
        ClosingDate          = closingDate;
        Description          = description.Trim();
        RequirementsText     = requirementsText;
        ResponsibilitiesText = responsibilitiesText;
        HiringManager        = hiringManager?.Trim();
        Applicants           = 0;
        CreatedAt            = DateTime.UtcNow;
    }

    public Guid      Id                   { get; private set; }
    public string    Title                { get; private set; } = string.Empty;
    public string    Department           { get; private set; } = string.Empty;
    public string    Branch               { get; private set; } = string.Empty;
    public string    Type                 { get; private set; } = string.Empty;
    public string    ExperienceLevel      { get; private set; } = string.Empty;
    public int       Headcount            { get; private set; }
    public decimal   SalaryMin            { get; private set; }
    public decimal   SalaryMax            { get; private set; }
    public string    Currency             { get; private set; } = TenantCurrency.Resolve();
    public string    Status               { get; private set; } = "draft";
    public string    PostedDate           { get; private set; } = string.Empty;
    public string?   ClosingDate          { get; private set; }
    public int       Applicants           { get; private set; }
    public string    Description          { get; private set; } = string.Empty;
    public string?   RequirementsText     { get; private set; }
    public string?   ResponsibilitiesText { get; private set; }
    public string?   HiringManager        { get; private set; }
    public DateTime  CreatedAt            { get; private set; }
    public DateTime? UpdatedAt            { get; private set; }
    public bool      IsDeleted            { get; private set; }

    public void Update(
        string  title,
        string  department,
        string  branch,
        string  type,
        string  experienceLevel,
        int     headcount,
        decimal salaryMin,
        decimal salaryMax,
        string  currency,
        string? closingDate,
        string? hiringManager,
        string  description,
        string? requirementsText,
        string? responsibilitiesText,
        string  status)
    {
        Title                = title.Trim();
        Department           = department.Trim();
        Branch               = branch.Trim();
        Type                 = type;
        ExperienceLevel      = experienceLevel;
        Headcount            = headcount;
        SalaryMin            = salaryMin;
        SalaryMax            = salaryMax;
        Currency             = currency;
        ClosingDate          = closingDate;
        Description          = description.Trim();
        RequirementsText     = requirementsText;
        ResponsibilitiesText = responsibilitiesText;
        HiringManager        = hiringManager?.Trim();
        Status               = status;
        UpdatedAt            = DateTime.UtcNow;
    }

    public void SetStatus(string status)
    {
        Status    = status;
        UpdatedAt = DateTime.UtcNow;
    }

    public void IncrementApplicants()
    {
        Applicants++;
        UpdatedAt = DateTime.UtcNow;
    }

    public void DecrementApplicants()
    {
        if (Applicants > 0) Applicants--;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}
