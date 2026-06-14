namespace Softaxis.HR.Application.Recruitment.Dtos;

public sealed record JobPostingDto(
    Guid     Id,
    string   Title,
    string   Department,
    string   Branch,
    string   Type,
    string   ExperienceLevel,
    int      Headcount,
    decimal  SalaryMin,
    decimal  SalaryMax,
    string   Currency,
    string   Status,
    string   PostedDate,
    string?  ClosingDate,
    int      Applicants,
    string   Description,
    IReadOnlyList<string> Requirements,
    IReadOnlyList<string> Responsibilities,
    string?  HiringManager);

public sealed record ApplicantDto(
    Guid    Id,
    Guid    JobId,
    string  JobTitle,
    string  Name,
    string  Email,
    string? Phone,
    string? Nationality,
    string? CurrentRole,
    string? CurrentCompany,
    int     Experience,
    string  Stage,
    string  AppliedDate,
    int?    Rating,
    string? Notes,
    string? Source,
    bool    HasResume);

public sealed record ApplicantResumeDto(
    string  StoragePath,
    string? FileName);

public sealed record RecruitmentSummaryDto(
    int OpenPositions,
    int TotalApplicants,
    int InInterview,
    int Offers,
    int HiredThisMonth,
    int AvgTimeToHire);
