using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.CRM.API.Controllers.Common;
using Softaxis.CRM.Application.Education.Commands;
using Softaxis.CRM.Application.Education.Queries;

namespace Softaxis.CRM.API.Controllers;

/// <summary>
/// Education pack: Admissions → Students → Enrollments (with fee tracking).
/// Admissions/students extend CRM leads/customers — reuse, not duplication.
/// </summary>
[ApiController][Route("api/education")][Authorize]
public sealed class EducationController(ISender sender) : CrmControllerBase
{
    [HttpGet("summary")]
    public async Task<IActionResult> Summary(CancellationToken ct)
    {
        var result = await sender.Send(new GetEducationSummaryQuery(), ct);
        return OkOrError(result);
    }

    // ── Admissions ────────────────────────────────────────────────────────────
    [HttpGet("admissions")]
    public async Task<IActionResult> GetAdmissions(CancellationToken ct)
    {
        var result = await sender.Send(new GetAdmissionsQuery(), ct);
        return OkOrError(result);
    }

    [HttpPost("admissions")]
    public async Task<IActionResult> CreateAdmission([FromBody] CreateAdmissionCommand cmd, CancellationToken ct)
    {
        var result = await sender.Send(cmd, ct);
        return OkOrError(result);
    }

    [HttpPatch("admissions/{id:guid}/status")]
    public async Task<IActionResult> AdmStatus(Guid id, [FromBody] StatusReq r, CancellationToken ct)
    {
        var result = await sender.Send(new UpdateAdmissionStatusCommand(id, r.Status), ct);
        return NoContentOrError(result);
    }

    /// <summary>Convert an accepted admission into an enrolled student.</summary>
    [HttpPost("admissions/{id:guid}/enroll")]
    public async Task<IActionResult> EnrollAdmission(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new EnrollAdmissionCommand(id), ct);
        return OkOrError(result);
    }

    [HttpDelete("admissions/{id:guid}")]
    public async Task<IActionResult> DeleteAdmission(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new DeleteAdmissionCommand(id), ct);
        return NoContentOrError(result);
    }

    // ── Students ──────────────────────────────────────────────────────────────
    [HttpGet("students")]
    public async Task<IActionResult> GetStudents(CancellationToken ct)
    {
        var result = await sender.Send(new GetStudentsQuery(), ct);
        return OkOrError(result);
    }

    [HttpPost("students")]
    public async Task<IActionResult> CreateStudent([FromBody] CreateStudentCommand cmd, CancellationToken ct)
    {
        var result = await sender.Send(cmd, ct);
        return OkOrError(result);
    }

    [HttpDelete("students/{id:guid}")]
    public async Task<IActionResult> DeleteStudent(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new DeleteStudentCommand(id), ct);
        return NoContentOrError(result);
    }

    // ── Enrollments ───────────────────────────────────────────────────────────
    [HttpGet("enrollments")]
    public async Task<IActionResult> GetEnrollments([FromQuery] Guid? studentId, CancellationToken ct)
    {
        var result = await sender.Send(new GetEnrollmentsQuery(studentId), ct);
        return OkOrError(result);
    }

    [HttpPost("enrollments")]
    public async Task<IActionResult> CreateEnrollment([FromBody] CreateEnrollmentCommand cmd, CancellationToken ct)
    {
        var result = await sender.Send(cmd, ct);
        return OkOrError(result);
    }

    [HttpPost("enrollments/{id:guid}/payment")]
    public async Task<IActionResult> RecordFee(Guid id, [FromBody] PaymentReq r, CancellationToken ct)
    {
        var result = await sender.Send(new RecordEnrollmentPaymentCommand(id, r.Amount), ct);
        return OkOrError(result);
    }

    [HttpPatch("enrollments/{id:guid}/status")]
    public async Task<IActionResult> EnrStatus(Guid id, [FromBody] StatusReq r, CancellationToken ct)
    {
        var result = await sender.Send(new UpdateEnrollmentStatusCommand(id, r.Status), ct);
        return NoContentOrError(result);
    }

    [HttpDelete("enrollments/{id:guid}")]
    public async Task<IActionResult> DeleteEnrollment(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new DeleteEnrollmentCommand(id), ct);
        return NoContentOrError(result);
    }

    public sealed record StatusReq(string Status);
    public sealed record PaymentReq(decimal Amount);
}
