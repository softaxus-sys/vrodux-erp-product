using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Softaxis.HR.API.Controllers.Common;
using Softaxis.HR.Application.Careers.Commands;
using Softaxis.HR.Application.Careers.Dtos;
using Softaxis.HR.Application.Careers.Queries;

namespace Softaxis.HR.API.Controllers;

/// <summary>
/// Public, anonymous job-board + application endpoints for the careers portal.
/// Tenant is resolved from the URL slug (no JWT) — see <c>TenantLookup</c>.
/// </summary>
[Route("api/hr/careers")]
[AllowAnonymous]
public sealed class CareersController(ISender sender, IWebHostEnvironment env) : HrControllerBase
{
    private const long MaxResumeBytes = 5 * 1024 * 1024; // 5 MB

    [HttpGet("{tenantSlug}/company")]
    public async Task<IActionResult> GetCompany(string tenantSlug, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetCareersCompanyQuery(tenantSlug), ct));

    [HttpGet("{tenantSlug}/jobs")]
    public async Task<IActionResult> GetOpenJobs(string tenantSlug, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetOpenJobsQuery(tenantSlug), ct));

    [HttpGet("{tenantSlug}/jobs/{id:guid}")]
    public async Task<IActionResult> GetOpenJob(string tenantSlug, Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetOpenJobByIdQuery(tenantSlug, id), ct));

    [HttpPost("{tenantSlug}/applicants")]
    [RequestSizeLimit(MaxResumeBytes + 1024 * 1024)]
    public async Task<IActionResult> Apply(string tenantSlug, [FromForm] ApplyForm form, CancellationToken ct)
    {
        ResumeUploadDto? resume = null;
        if (form.Resume is { Length: > 0 })
        {
            resume = new ResumeUploadDto(
                form.Resume.FileName,
                Path.GetExtension(form.Resume.FileName).ToLowerInvariant(),
                form.Resume.Length,
                form.Resume.OpenReadStream());
        }

        var cmd = new ApplyToJobCommand(
            tenantSlug, form.JobId, form.Name, form.Email, form.Phone, form.Nationality,
            form.CurrentRole, form.CurrentCompany, form.Experience, form.CoverNote,
            resume, Path.Combine(env.ContentRootPath, "App_Data"));

        var result = await sender.Send(cmd, ct);
        return OkOrError(result);
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
}
