using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.HR.Domain.Entities;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.API.Controllers;

/// <summary>
/// Public, anonymous job-board + application endpoints for the careers portal.
/// Tenant is resolved from the URL slug (no JWT) — see <see cref="TenantLookup"/>.
/// </summary>
[ApiController]
[Route("api/hr/careers")]
[AllowAnonymous]
public sealed class CareersController(HrDbContext db, IWebHostEnvironment env) : ControllerBase
{
    private const long MaxResumeBytes = 5 * 1024 * 1024; // 5 MB
    private static readonly string[] AllowedResumeExtensions = [".pdf", ".doc", ".docx"];

    // ── DTOs ─────────────────────────────────────────────────────────────
    public record CompanyDto(string Name, string Slug, string? Industry);

    public record PublicJobDto(
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

    public record ApplyResultDto(Guid ApplicantId, string Message);

    // ── GET /api/hr/careers/{tenantSlug}/company ─────────────────────────
    [HttpGet("{tenantSlug}/company")]
    public async Task<IActionResult> GetCompany(string tenantSlug, CancellationToken ct)
    {
        var tenant = await ResolveTenantAsync(tenantSlug, ct);
        if (tenant is null) return NotFound(new { error = "Company not found." });

        return Ok(new CompanyDto(tenant.Name, tenant.Slug, null));
    }

    // ── GET /api/hr/careers/{tenantSlug}/jobs ────────────────────────────
    [HttpGet("{tenantSlug}/jobs")]
    public async Task<IActionResult> GetOpenJobs(string tenantSlug, CancellationToken ct)
    {
        var tenant = await ResolveTenantAsync(tenantSlug, ct);
        if (tenant is null) return NotFound(new { error = "Company not found." });

        var jobs = await db.JobPostings.AsNoTracking()
            .Where(x => x.Status == "open" && EF.Property<Guid?>(x, TenantIsolation.Column) == tenant.Id)
            .OrderByDescending(x => x.PostedDate)
            .ToListAsync(ct);

        return Ok(jobs.Select(ToDto).ToList());
    }

    // ── GET /api/hr/careers/{tenantSlug}/jobs/{id} ───────────────────────
    [HttpGet("{tenantSlug}/jobs/{id:guid}")]
    public async Task<IActionResult> GetOpenJob(string tenantSlug, Guid id, CancellationToken ct)
    {
        var tenant = await ResolveTenantAsync(tenantSlug, ct);
        if (tenant is null) return NotFound(new { error = "Company not found." });

        var job = await db.JobPostings.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id && x.Status == "open"
                && EF.Property<Guid?>(x, TenantIsolation.Column) == tenant.Id, ct);

        if (job is null) return NotFound(new { error = "Job posting not found." });

        return Ok(ToDto(job));
    }

    // ── POST /api/hr/careers/{tenantSlug}/applicants ─────────────────────
    [HttpPost("{tenantSlug}/applicants")]
    [RequestSizeLimit(MaxResumeBytes + 1024 * 1024)]
    public async Task<IActionResult> Apply(string tenantSlug, [FromForm] ApplyForm form, CancellationToken ct)
    {
        var tenant = await ResolveTenantAsync(tenantSlug, ct);
        if (tenant is null) return NotFound(new { error = "Company not found." });

        var job = await db.JobPostings
            .FirstOrDefaultAsync(x => x.Id == form.JobId && x.Status == "open"
                && EF.Property<Guid?>(x, TenantIsolation.Column) == tenant.Id, ct);
        if (job is null) return NotFound(new { error = "Job posting not found or no longer open." });

        if (string.IsNullOrWhiteSpace(form.Name) || string.IsNullOrWhiteSpace(form.Email))
            return BadRequest(new { error = "Name and email are required." });

        var applicant = new Applicant(
            job.Id, job.Title, form.Name, form.Email, form.Phone, form.Nationality,
            form.CurrentRole, form.CurrentCompany, form.Experience ?? 0,
            "careers_portal", form.CoverNote);

        // Stamp the tenant directly — this request is anonymous, so TenantAmbient
        // is unresolved and StampTenantId() (called from SaveChangesAsync) is a no-op.
        db.Entry(applicant).Property(TenantIsolation.Column).CurrentValue = tenant.Id;

        if (form.Resume is { Length: > 0 } resume)
        {
            var ext = Path.GetExtension(resume.FileName).ToLowerInvariant();
            if (!AllowedResumeExtensions.Contains(ext))
                return BadRequest(new { error = "Resume must be a PDF or Word document." });
            if (resume.Length > MaxResumeBytes)
                return BadRequest(new { error = "Resume must be 5 MB or smaller." });

            var dir = Path.Combine(env.ContentRootPath, "App_Data", "resumes", tenant.Id.ToString());
            Directory.CreateDirectory(dir);

            var storedName = $"{applicant.Id}{ext}";
            var fullPath = Path.Combine(dir, storedName);
            await using (var stream = System.IO.File.Create(fullPath))
                await resume.CopyToAsync(stream, ct);

            applicant.AttachResume(resume.FileName, Path.Combine("resumes", tenant.Id.ToString(), storedName));
        }

        job.IncrementApplicants();
        db.Applicants.Add(applicant);
        await db.SaveChangesAsync(ct);

        return Ok(new ApplyResultDto(applicant.Id, "Application submitted successfully."));
    }

    public sealed class ApplyForm
    {
        public Guid    JobId          { get; set; }
        public string  Name           { get; set; } = string.Empty;
        public string  Email          { get; set; } = string.Empty;
        public string? Phone          { get; set; }
        public string? Nationality    { get; set; }
        public string? CurrentRole    { get; set; }
        public string? CurrentCompany { get; set; }
        public int?    Experience     { get; set; }
        public string? CoverNote      { get; set; }
        public IFormFile? Resume      { get; set; }
    }

    // ── Helpers ───────────────────────────────────────────────────────────
    private async Task<TenantLookup?> ResolveTenantAsync(string slug, CancellationToken ct)
    {
        var normalised = slug.Trim().ToLowerInvariant();
        var tenant = await db.TenantLookups.AsNoTracking().FirstOrDefaultAsync(x => x.Slug == normalised, ct);
        return tenant is null || tenant.Status is "Suspended" or "Expired" ? null : tenant;
    }

    private static IReadOnlyList<string> SplitLines(string? text) =>
        string.IsNullOrWhiteSpace(text)
            ? Array.Empty<string>()
            : text.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    private static PublicJobDto ToDto(JobPosting j) => new(
        j.Id, j.Title, j.Department, j.Branch, j.Type, j.ExperienceLevel, j.Headcount,
        j.SalaryMin, j.SalaryMax, j.Currency, j.PostedDate, j.ClosingDate,
        j.Description, SplitLines(j.RequirementsText), SplitLines(j.ResponsibilitiesText));
}
