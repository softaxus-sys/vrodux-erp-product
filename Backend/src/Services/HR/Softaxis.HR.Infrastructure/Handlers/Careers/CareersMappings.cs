using Microsoft.EntityFrameworkCore;
using Softaxis.HR.Application.Careers.Dtos;
using Softaxis.HR.Domain.Entities;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Careers;

internal static class CareersMappings
{
    public static async Task<TenantLookup?> ResolveTenantAsync(HrDbContext db, string slug, CancellationToken ct)
    {
        var normalised = slug.Trim().ToLowerInvariant();
        var tenant = await db.TenantLookups.AsNoTracking().FirstOrDefaultAsync(x => x.Slug == normalised, ct);
        return tenant is null || tenant.Status is "Suspended" or "Expired" ? null : tenant;
    }

    public static IReadOnlyList<string> SplitLines(string? text) =>
        string.IsNullOrWhiteSpace(text)
            ? Array.Empty<string>()
            : text.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    public static PublicJobDto ToDto(JobPosting j) => new(
        j.Id, j.Title, j.Department, j.Branch, j.Type, j.ExperienceLevel, j.Headcount,
        j.SalaryMin, j.SalaryMax, j.Currency, j.PostedDate, j.ClosingDate,
        j.Description, SplitLines(j.RequirementsText), SplitLines(j.ResponsibilitiesText));
}
