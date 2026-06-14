using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.CRM.API.Controllers.Common;
using Softaxis.CRM.Application.Healthcare.Commands;
using Softaxis.CRM.Application.Healthcare.Queries;

namespace Softaxis.CRM.API.Controllers;

/// <summary>
/// Healthcare pack: Patients → Appointments → Treatment plans.
/// Patients extend CRM customers/leads (CustomerId/LeadId links) — reuse, not duplication.
/// </summary>
[ApiController][Route("api/healthcare")][Authorize]
public sealed class HealthcareController(ISender sender) : CrmControllerBase
{
    [HttpGet("summary")]
    public async Task<IActionResult> Summary(CancellationToken ct)
    {
        var result = await sender.Send(new GetHealthcareSummaryQuery(), ct);
        return OkOrError(result);
    }

    // ── Patients ──────────────────────────────────────────────────────────────
    [HttpGet("patients")]
    public async Task<IActionResult> GetPatients(CancellationToken ct)
    {
        var result = await sender.Send(new GetPatientsQuery(), ct);
        return OkOrError(result);
    }

    [HttpPost("patients")]
    public async Task<IActionResult> CreatePatient([FromBody] CreatePatientCommand cmd, CancellationToken ct)
    {
        var result = await sender.Send(cmd, ct);
        return OkOrError(result);
    }

    [HttpPut("patients/{id:guid}")]
    public async Task<IActionResult> UpdatePatient(Guid id, [FromBody] UpdatePatientRequest req, CancellationToken ct)
    {
        var result = await sender.Send(new UpdatePatientCommand(id, req.FullName, req.Gender, req.DateOfBirth,
            req.Phone, req.Email, req.BloodGroup, req.AssignedDoctor, req.Status, req.Notes), ct);
        return NoContentOrError(result);
    }

    [HttpDelete("patients/{id:guid}")]
    public async Task<IActionResult> DeletePatient(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new DeletePatientCommand(id), ct);
        return NoContentOrError(result);
    }

    // ── Appointments ──────────────────────────────────────────────────────────
    [HttpGet("appointments")]
    public async Task<IActionResult> GetAppointments([FromQuery] Guid? patientId, CancellationToken ct)
    {
        var result = await sender.Send(new GetAppointmentsQuery(patientId), ct);
        return OkOrError(result);
    }

    [HttpPost("appointments")]
    public async Task<IActionResult> CreateAppointment([FromBody] CreateAppointmentCommand cmd, CancellationToken ct)
    {
        var result = await sender.Send(cmd, ct);
        return OkOrError(result);
    }

    [HttpPatch("appointments/{id:guid}/status")]
    public async Task<IActionResult> ApptStatus(Guid id, [FromBody] StatusReq r, CancellationToken ct)
    {
        var result = await sender.Send(new UpdateAppointmentStatusCommand(id, r.Status), ct);
        return NoContentOrError(result);
    }

    [HttpDelete("appointments/{id:guid}")]
    public async Task<IActionResult> DeleteAppointment(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new DeleteAppointmentCommand(id), ct);
        return NoContentOrError(result);
    }

    // ── Treatment Plans ───────────────────────────────────────────────────────
    [HttpGet("treatment-plans")]
    public async Task<IActionResult> GetPlans([FromQuery] Guid? patientId, CancellationToken ct)
    {
        var result = await sender.Send(new GetTreatmentPlansQuery(patientId), ct);
        return OkOrError(result);
    }

    [HttpPost("treatment-plans")]
    public async Task<IActionResult> CreatePlan([FromBody] CreateTreatmentPlanCommand cmd, CancellationToken ct)
    {
        var result = await sender.Send(cmd, ct);
        return OkOrError(result);
    }

    [HttpPatch("treatment-plans/{id:guid}/status")]
    public async Task<IActionResult> PlanStatus(Guid id, [FromBody] StatusReq r, CancellationToken ct)
    {
        var result = await sender.Send(new UpdateTreatmentPlanStatusCommand(id, r.Status), ct);
        return NoContentOrError(result);
    }

    [HttpDelete("treatment-plans/{id:guid}")]
    public async Task<IActionResult> DeletePlan(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new DeleteTreatmentPlanCommand(id), ct);
        return NoContentOrError(result);
    }

    public sealed record UpdatePatientRequest(string FullName, string? Gender, string? DateOfBirth, string? Phone, string? Email, string? BloodGroup, string? AssignedDoctor, string Status, string? Notes);
    public sealed record StatusReq(string Status);
}
