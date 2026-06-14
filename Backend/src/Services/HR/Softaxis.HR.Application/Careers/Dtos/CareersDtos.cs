namespace Softaxis.HR.Application.Careers.Dtos;

public sealed record CompanyDto(string Name, string Slug, string? Industry);

public sealed record PublicJobDto(
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
    string   PostedDate,
    string?  ClosingDate,
    string   Description,
    IReadOnlyList<string> Requirements,
    IReadOnlyList<string> Responsibilities);

public sealed record ApplyResultDto(Guid ApplicantId, string Message);

public sealed record ResumeUploadDto(
    string FileName,
    string Extension,
    long   Length,
    Stream Content);
