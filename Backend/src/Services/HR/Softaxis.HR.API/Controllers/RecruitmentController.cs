using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Softaxis.HR.Domain.Entities;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.API.Controllers;

[ApiController]
[Route("api/hr/recruitment")]
[Authorize]
public sealed class RecruitmentController(HrDbContext db) : ControllerBase
{
    // ── DTOs ─────────────────────────────────────────────────────────────
    public record JobPostingDto(
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

    public record CreateJobPostingRequest(
        string   Title,
        string   Department,
        string   Branch,
        string   Type,
        string   ExperienceLevel,
        int      Headcount,
        decimal  SalaryMin,
        decimal  SalaryMax,
        string   Currency,
        string?  ClosingDate,
        string?  HiringManager,
        string   Description,
        IReadOnlyList<string>? Requirements,
        IReadOnlyList<string>? Responsibilities,
        string   Status);

    public record UpdateJobPostingRequest(
        string   Title,
        string   Department,
        string   Branch,
        string   Type,
        string   ExperienceLevel,
        int      Headcount,
        decimal  SalaryMin,
        decimal  SalaryMax,
        string   Currency,
        string?  ClosingDate,
        string?  HiringManager,
        string   Description,
        IReadOnlyList<string>? Requirements,
        IReadOnlyList<string>? Responsibilities,
        string   Status);

    public record PagedResult<T>(
        IReadOnlyList<T> Items,
        int Page,
        int PageSize,
        int TotalCount,
        int TotalPages,
        bool HasNext,
        bool HasPrev);

    public record ApplicantDto(
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
        string? Source);

    public record CreateApplicantRequest(
        Guid    JobId,
        string  Name,
        string  Email,
        string? Phone,
        string? Nationality,
        string? CurrentRole,
        string? CurrentCompany,
        int     Experience,
        string? Source,
        string? Notes);

    public record UpdateApplicantStageRequest(string Stage);

    public record UpdateJobStatusRequest(string Status);

    // ── GET /api/hr/recruitment/jobs ─────────────────────────────────────
    [HttpGet("jobs")]
    public async Task<IActionResult> GetJobs(
        [FromQuery] int     page     = 1,
        [FromQuery] int     pageSize = 20,
        [FromQuery] string? status   = null,
        CancellationToken ct = default)
    {
        IQueryable<JobPosting> query = db.JobPostings.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(x => x.Status == status);

        var total      = await query.CountAsync(ct);
        var totalPages = (int)Math.Ceiling((double)total / pageSize);

        var items = await query
            .OrderByDescending(x => x.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return Ok(new PagedResult<JobPostingDto>(items.Select(ToDto).ToList(), page, pageSize, total, totalPages,
            page < totalPages, page > 1));
    }

    // ── GET /api/hr/recruitment/jobs/{id} ────────────────────────────────
    [HttpGet("jobs/{id:guid}")]
    public async Task<IActionResult> GetJobById(Guid id, CancellationToken ct)
    {
        var job = await db.JobPostings.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (job is null) return NotFound();
        return Ok(ToDto(job));
    }

    // ── POST /api/hr/recruitment/jobs ────────────────────────────────────
    [HttpPost("jobs")]
    public async Task<IActionResult> CreateJob([FromBody] CreateJobPostingRequest req, CancellationToken ct)
    {
        var job = new JobPosting(
            req.Title, req.Department, req.Branch, req.Type, req.ExperienceLevel,
            req.Headcount, req.SalaryMin, req.SalaryMax, req.Currency,
            req.ClosingDate, req.HiringManager, req.Description,
            JoinLines(req.Requirements), JoinLines(req.Responsibilities),
            req.Status);

        db.JobPostings.Add(job);
        await db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetJobById), new { id = job.Id }, ToDto(job));
    }

    // ── PUT /api/hr/recruitment/jobs/{id} ────────────────────────────────
    [HttpPut("jobs/{id:guid}")]
    public async Task<IActionResult> UpdateJob(Guid id, [FromBody] UpdateJobPostingRequest req, CancellationToken ct)
    {
        var job = await db.JobPostings.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (job is null) return NotFound();

        job.Update(
            req.Title, req.Department, req.Branch, req.Type, req.ExperienceLevel,
            req.Headcount, req.SalaryMin, req.SalaryMax, req.Currency,
            req.ClosingDate, req.HiringManager, req.Description,
            JoinLines(req.Requirements), JoinLines(req.Responsibilities),
            req.Status);

        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ── POST /api/hr/recruitment/jobs/{id}/publish ───────────────────────
    [HttpPost("jobs/{id:guid}/publish")]
    public async Task<IActionResult> PublishJob(Guid id, CancellationToken ct)
    {
        var job = await db.JobPostings.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (job is null) return NotFound();

        job.SetStatus("open");
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ── POST /api/hr/recruitment/jobs/{id}/status ────────────────────────
    [HttpPost("jobs/{id:guid}/status")]
    public async Task<IActionResult> SetJobStatus(Guid id, [FromBody] UpdateJobStatusRequest req, CancellationToken ct)
    {
        if (req.Status is not ("draft" or "open" or "on_hold" or "closed"))
            return BadRequest(new { error = "Status must be one of: draft, open, on_hold, closed." });

        var job = await db.JobPostings.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (job is null) return NotFound();

        job.SetStatus(req.Status);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ── DELETE /api/hr/recruitment/jobs/{id} ─────────────────────────────
    [HttpDelete("jobs/{id:guid}")]
    public async Task<IActionResult> DeleteJob(Guid id, CancellationToken ct)
    {
        var job = await db.JobPostings.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (job is null) return NotFound();

        job.Delete();
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ── GET /api/hr/recruitment/applicants ───────────────────────────────
    [HttpGet("applicants")]
    public async Task<IActionResult> GetApplicants(
        [FromQuery] int     page     = 1,
        [FromQuery] int     pageSize = 20,
        [FromQuery] Guid?   jobId    = null,
        [FromQuery] string? stage    = null,
        CancellationToken ct = default)
    {
        IQueryable<Applicant> query = db.Applicants.AsNoTracking();

        if (jobId is not null)
            query = query.Where(x => x.JobPostingId == jobId);

        if (!string.IsNullOrWhiteSpace(stage))
            query = query.Where(x => x.Stage == stage);

        var total      = await query.CountAsync(ct);
        var totalPages = (int)Math.Ceiling((double)total / pageSize);

        var items = await query
            .OrderByDescending(x => x.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return Ok(new PagedResult<ApplicantDto>(items.Select(ToDto).ToList(), page, pageSize, total, totalPages,
            page < totalPages, page > 1));
    }

    // ── GET /api/hr/recruitment/applicants/{id} ──────────────────────────
    [HttpGet("applicants/{id:guid}")]
    public async Task<IActionResult> GetApplicantById(Guid id, CancellationToken ct)
    {
        var applicant = await db.Applicants.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (applicant is null) return NotFound();
        return Ok(ToDto(applicant));
    }

    // ── POST /api/hr/recruitment/applicants ──────────────────────────────
    [HttpPost("applicants")]
    public async Task<IActionResult> CreateApplicant([FromBody] CreateApplicantRequest req, CancellationToken ct)
    {
        var job = await db.JobPostings.FirstOrDefaultAsync(x => x.Id == req.JobId, ct);
        if (job is null) return NotFound(new { error = "Job posting not found." });

        var applicant = new Applicant(
            req.JobId, job.Title, req.Name, req.Email, req.Phone, req.Nationality,
            req.CurrentRole, req.CurrentCompany, req.Experience, req.Source, req.Notes);

        job.IncrementApplicants();
        db.Applicants.Add(applicant);
        await db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetApplicantById), new { id = applicant.Id }, ToDto(applicant));
    }

    // ── PUT /api/hr/recruitment/applicants/{id}/stage ────────────────────
    [HttpPut("applicants/{id:guid}/stage")]
    public async Task<IActionResult> UpdateApplicantStage(Guid id, [FromBody] UpdateApplicantStageRequest req, CancellationToken ct)
    {
        if (req.Stage is not ("applied" or "screening" or "interview" or "offer" or "hired" or "rejected"))
            return BadRequest(new { error = "Invalid stage." });

        var applicant = await db.Applicants.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (applicant is null) return NotFound();

        applicant.SetStage(req.Stage);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ── DELETE /api/hr/recruitment/applicants/{id} ───────────────────────
    [HttpDelete("applicants/{id:guid}")]
    public async Task<IActionResult> DeleteApplicant(Guid id, CancellationToken ct)
    {
        var applicant = await db.Applicants.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (applicant is null) return NotFound();

        var job = await db.JobPostings.FirstOrDefaultAsync(x => x.Id == applicant.JobPostingId, ct);
        job?.DecrementApplicants();

        applicant.Delete();
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ── GET /api/hr/recruitment/summary ──────────────────────────────────
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var openPositions   = await db.JobPostings.AsNoTracking().CountAsync(x => x.Status == "open", ct);
        var totalApplicants = await db.Applicants.AsNoTracking().CountAsync(ct);
        var inInterview     = await db.Applicants.AsNoTracking().CountAsync(x => x.Stage == "interview", ct);
        var offers          = await db.Applicants.AsNoTracking().CountAsync(x => x.Stage == "offer", ct);

        var thisMonth = DateTime.UtcNow.ToString("yyyy-MM");
        var hiredThisMonth = await db.Applicants.AsNoTracking()
            .CountAsync(x => x.Stage == "hired" && x.AppliedDate.StartsWith(thisMonth), ct);

        return Ok(new
        {
            OpenPositions   = openPositions,
            TotalApplicants = totalApplicants,
            InInterview     = inInterview,
            Offers          = offers,
            HiredThisMonth  = hiredThisMonth,
            AvgTimeToHire   = 0,
        });
    }

    // ── Helpers ───────────────────────────────────────────────────────────
    private static string? JoinLines(IReadOnlyList<string>? lines) =>
        lines is null || lines.Count == 0
            ? null
            : string.Join('\n', lines.Select(l => l.Trim()).Where(l => l.Length > 0));

    private static IReadOnlyList<string> SplitLines(string? text) =>
        string.IsNullOrWhiteSpace(text)
            ? Array.Empty<string>()
            : text.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    private static JobPostingDto ToDto(JobPosting j) => new(
        j.Id, j.Title, j.Department, j.Branch, j.Type, j.ExperienceLevel, j.Headcount,
        j.SalaryMin, j.SalaryMax, j.Currency, j.Status, j.PostedDate, j.ClosingDate,
        j.Applicants, j.Description, SplitLines(j.RequirementsText), SplitLines(j.ResponsibilitiesText),
        j.HiringManager);

    private static ApplicantDto ToDto(Applicant a) => new(
        a.Id, a.JobPostingId, a.JobTitle, a.Name, a.Email, a.Phone, a.Nationality,
        a.CurrentRole, a.CurrentCompany, a.ExperienceYears, a.Stage, a.AppliedDate,
        a.Rating, a.Notes, a.Source);
}
