using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;
using Softaxis.HR.API.Controllers.Common;
using Softaxis.HR.Application.Recruitment.Commands;
using Softaxis.HR.Application.Recruitment.Queries;

namespace Softaxis.HR.API.Controllers;

[Route("api/hr/recruitment")]
[Authorize]
public sealed class RecruitmentController(ISender sender, IWebHostEnvironment env) : HrControllerBase
{
    [HttpGet("jobs")]
    public async Task<IActionResult> GetJobs(
        [FromQuery] int     page     = 1,
        [FromQuery] int     pageSize = 20,
        [FromQuery] string? status   = null,
        CancellationToken ct = default) =>
        OkOrError(await sender.Send(new GetJobPostingsQuery(page, pageSize, status), ct));

    [HttpGet("jobs/{id:guid}")]
    public async Task<IActionResult> GetJobById(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetJobPostingByIdQuery(id), ct));

    [HttpPost("jobs")]
    public async Task<IActionResult> CreateJob([FromBody] CreateJobPostingCommand cmd, CancellationToken ct)
    {
        var result = await sender.Send(cmd, ct);
        return CreatedOrError(result, nameof(GetJobById),
            result.IsSuccess ? new { id = result.Value.Id } : null!);
    }

    [HttpPut("jobs/{id:guid}")]
    public async Task<IActionResult> UpdateJob(Guid id, [FromBody] UpdateJobPostingRequest req, CancellationToken ct) =>
        NoContentOrError(await sender.Send(
            new UpdateJobPostingCommand(id, req.Title, req.Department, req.Branch, req.Type, req.ExperienceLevel,
                req.Headcount, req.SalaryMin, req.SalaryMax, req.Currency, req.ClosingDate, req.HiringManager,
                req.Description, req.Requirements, req.Responsibilities, req.Status), ct));

    [HttpPost("jobs/{id:guid}/publish")]
    public async Task<IActionResult> PublishJob(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new PublishJobCommand(id), ct));

    [HttpPost("jobs/{id:guid}/status")]
    public async Task<IActionResult> SetJobStatus(Guid id, [FromBody] UpdateJobStatusRequest req, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new SetJobStatusCommand(id, req.Status), ct));

    [HttpDelete("jobs/{id:guid}")]
    public async Task<IActionResult> DeleteJob(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteJobCommand(id), ct));

    [HttpGet("applicants")]
    public async Task<IActionResult> GetApplicants(
        [FromQuery] int     page     = 1,
        [FromQuery] int     pageSize = 20,
        [FromQuery] Guid?   jobId    = null,
        [FromQuery] string? stage    = null,
        CancellationToken ct = default) =>
        OkOrError(await sender.Send(new GetApplicantsQuery(page, pageSize, jobId, stage), ct));

    [HttpGet("applicants/{id:guid}")]
    public async Task<IActionResult> GetApplicantById(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetApplicantByIdQuery(id), ct));

    [HttpGet("applicants/{id:guid}/resume")]
    public async Task<IActionResult> GetApplicantResume(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new GetApplicantResumeQuery(id), ct);
        if (!result.IsSuccess)
            return NotFound();

        var fullPath = Path.Combine(env.ContentRootPath, "App_Data", result.Value.StoragePath);
        if (!System.IO.File.Exists(fullPath)) return NotFound();

        var provider = new FileExtensionContentTypeProvider();
        if (!provider.TryGetContentType(fullPath, out var contentType))
            contentType = "application/octet-stream";

        var fileName = result.Value.FileName ?? Path.GetFileName(fullPath);
        return PhysicalFile(fullPath, contentType, fileName);
    }

    [HttpPost("applicants")]
    public async Task<IActionResult> CreateApplicant([FromBody] CreateApplicantCommand cmd, CancellationToken ct)
    {
        var result = await sender.Send(cmd, ct);
        return CreatedOrError(result, nameof(GetApplicantById),
            result.IsSuccess ? new { id = result.Value.Id } : null!);
    }

    [HttpPut("applicants/{id:guid}/stage")]
    public async Task<IActionResult> UpdateApplicantStage(Guid id, [FromBody] UpdateApplicantStageRequest req, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new UpdateApplicantStageCommand(id, req.Stage), ct));

    [HttpDelete("applicants/{id:guid}")]
    public async Task<IActionResult> DeleteApplicant(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteApplicantCommand(id), ct));

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetRecruitmentSummaryQuery(), ct));

    public sealed record UpdateJobPostingRequest(
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

    public sealed record UpdateApplicantStageRequest(string Stage);

    public sealed record UpdateJobStatusRequest(string Status);
}
