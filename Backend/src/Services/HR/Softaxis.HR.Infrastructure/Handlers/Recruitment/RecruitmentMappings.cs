using Softaxis.HR.Application.Recruitment.Dtos;
using Softaxis.HR.Domain.Entities;

namespace Softaxis.HR.Infrastructure.Handlers.Recruitment;

internal static class RecruitmentMappings
{
    public static string? JoinLines(IReadOnlyList<string>? lines) =>
        lines is null || lines.Count == 0
            ? null
            : string.Join('\n', lines.Select(l => l.Trim()).Where(l => l.Length > 0));

    public static IReadOnlyList<string> SplitLines(string? text) =>
        string.IsNullOrWhiteSpace(text)
            ? Array.Empty<string>()
            : text.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    public static JobPostingDto ToDto(JobPosting j) => new(
        j.Id, j.Title, j.Department, j.Branch, j.Type, j.ExperienceLevel, j.Headcount,
        j.SalaryMin, j.SalaryMax, j.Currency, j.Status, j.PostedDate, j.ClosingDate,
        j.Applicants, j.Description, SplitLines(j.RequirementsText), SplitLines(j.ResponsibilitiesText),
        j.HiringManager);

    public static ApplicantDto ToDto(Applicant a) => new(
        a.Id, a.JobPostingId, a.JobTitle, a.Name, a.Email, a.Phone, a.Nationality,
        a.CurrentRole, a.CurrentCompany, a.ExperienceYears, a.Stage, a.AppliedDate,
        a.Rating, a.Notes, a.Source, !string.IsNullOrEmpty(a.ResumeStoragePath));
}
