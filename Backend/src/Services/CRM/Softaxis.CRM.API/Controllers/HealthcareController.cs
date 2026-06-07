using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Softaxis.CRM.Domain.Entities;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.API.Controllers;

/// <summary>
/// Healthcare pack: Patients → Appointments → Treatment plans.
/// Patients extend CRM customers/leads (CustomerId/LeadId links) — reuse, not duplication.
/// </summary>
[ApiController][Route("api/healthcare")][Authorize]
public sealed class HealthcareController(CrmDbContext db) : ControllerBase
{
    [HttpGet("summary")]
    public async Task<IActionResult> Summary(CancellationToken ct)
    {
        var today = DateTime.UtcNow.ToString("yyyy-MM-dd");
        var patients = await db.Patients.AsNoTracking().CountAsync(ct);
        var appts = await db.Appointments.AsNoTracking().Select(a => new { a.Status, a.ScheduledAt }).ToListAsync(ct);
        var plans = await db.TreatmentPlans.AsNoTracking().CountAsync(x => x.Status == "active");
        return Ok(new
        {
            patients,
            scheduledAppointments = appts.Count(a => a.Status == "scheduled"),
            todayAppointments     = appts.Count(a => a.Status == "scheduled" && a.ScheduledAt.StartsWith(today)),
            completedAppointments = appts.Count(a => a.Status == "completed"),
            activeTreatments      = plans,
        });
    }

    // ── Patients ──────────────────────────────────────────────────────────────
    [HttpGet("patients")]
    public async Task<IActionResult> GetPatients(CancellationToken ct) =>
        Ok((await db.Patients.AsNoTracking().OrderByDescending(x => x.CreatedAt).ToListAsync(ct)).Select(PatientDto));

    [HttpPost("patients")]
    public async Task<IActionResult> CreatePatient([FromBody] CreatePatientReq r, CancellationToken ct)
    {
        var p = new Patient(r.LeadId, r.CustomerId, r.FullName, r.Gender ?? "", r.DateOfBirth, r.Phone ?? "", r.Email, r.BloodGroup, r.AssignedDoctor, r.Notes);
        db.Patients.Add(p); await db.SaveChangesAsync(ct); return Ok(PatientDto(p));
    }

    [HttpPut("patients/{id:guid}")]
    public async Task<IActionResult> UpdatePatient(Guid id, [FromBody] UpdatePatientReq r, CancellationToken ct)
    {
        var p = await db.Patients.FindAsync([id], ct); if (p is null) return NotFound();
        p.Update(r.FullName, r.Gender ?? "", r.DateOfBirth, r.Phone ?? "", r.Email, r.BloodGroup, r.AssignedDoctor, r.Status, r.Notes);
        await db.SaveChangesAsync(ct); return NoContent();
    }

    [HttpDelete("patients/{id:guid}")]
    public async Task<IActionResult> DeletePatient(Guid id, CancellationToken ct)
    { var p = await db.Patients.FindAsync([id], ct); if (p is null) return NotFound(); p.Delete(); await db.SaveChangesAsync(ct); return NoContent(); }

    // ── Appointments ──────────────────────────────────────────────────────────
    [HttpGet("appointments")]
    public async Task<IActionResult> GetAppointments([FromQuery] Guid? patientId, CancellationToken ct)
    {
        var q = db.Appointments.AsNoTracking().AsQueryable();
        if (patientId.HasValue) q = q.Where(x => x.PatientId == patientId.Value);
        return Ok((await q.OrderByDescending(x => x.CreatedAt).ToListAsync(ct)).Select(ApptDto));
    }

    [HttpPost("appointments")]
    public async Task<IActionResult> CreateAppointment([FromBody] CreateApptReq r, CancellationToken ct)
    {
        var a = new Appointment(r.PatientId, r.PatientName, r.Doctor, r.Department, r.ScheduledAt, r.Reason, r.Notes);
        db.Appointments.Add(a); await db.SaveChangesAsync(ct); return Ok(ApptDto(a));
    }

    [HttpPatch("appointments/{id:guid}/status")]
    public async Task<IActionResult> ApptStatus(Guid id, [FromBody] StatusReq r, CancellationToken ct)
    { var a = await db.Appointments.FindAsync([id], ct); if (a is null) return NotFound(); a.SetStatus(r.Status); await db.SaveChangesAsync(ct); return NoContent(); }

    [HttpDelete("appointments/{id:guid}")]
    public async Task<IActionResult> DeleteAppointment(Guid id, CancellationToken ct)
    { var a = await db.Appointments.FindAsync([id], ct); if (a is null) return NotFound(); a.Delete(); await db.SaveChangesAsync(ct); return NoContent(); }

    // ── Treatment Plans ───────────────────────────────────────────────────────
    [HttpGet("treatment-plans")]
    public async Task<IActionResult> GetPlans([FromQuery] Guid? patientId, CancellationToken ct)
    {
        var q = db.TreatmentPlans.AsNoTracking().AsQueryable();
        if (patientId.HasValue) q = q.Where(x => x.PatientId == patientId.Value);
        return Ok((await q.OrderByDescending(x => x.CreatedAt).ToListAsync(ct)).Select(PlanDto));
    }

    [HttpPost("treatment-plans")]
    public async Task<IActionResult> CreatePlan([FromBody] CreatePlanReq r, CancellationToken ct)
    {
        var p = new TreatmentPlan(r.PatientId, r.PatientName, r.Diagnosis, r.Plan, r.Doctor, r.StartDate, r.FollowUpDate, r.Notes);
        db.TreatmentPlans.Add(p); await db.SaveChangesAsync(ct); return Ok(PlanDto(p));
    }

    [HttpPatch("treatment-plans/{id:guid}/status")]
    public async Task<IActionResult> PlanStatus(Guid id, [FromBody] StatusReq r, CancellationToken ct)
    { var p = await db.TreatmentPlans.FindAsync([id], ct); if (p is null) return NotFound(); p.SetStatus(r.Status); await db.SaveChangesAsync(ct); return NoContent(); }

    [HttpDelete("treatment-plans/{id:guid}")]
    public async Task<IActionResult> DeletePlan(Guid id, CancellationToken ct)
    { var p = await db.TreatmentPlans.FindAsync([id], ct); if (p is null) return NotFound(); p.Delete(); await db.SaveChangesAsync(ct); return NoContent(); }

    private static object PatientDto(Patient p) => new { p.Id, p.PatientNumber, p.LeadId, p.CustomerId, p.FullName, p.Gender, p.DateOfBirth, p.Phone, p.Email, p.BloodGroup, p.AssignedDoctor, p.Status, p.RegisteredDate, p.Notes, p.CreatedAt };
    private static object ApptDto(Appointment a) => new { a.Id, a.AppointmentNumber, a.PatientId, a.PatientName, a.Doctor, a.Department, a.ScheduledAt, a.Status, a.Reason, a.Notes, a.CreatedAt };
    private static object PlanDto(TreatmentPlan p) => new { p.Id, p.PatientId, p.PatientName, p.Diagnosis, p.Plan, p.Doctor, p.StartDate, p.FollowUpDate, p.Status, p.Notes, p.CreatedAt };

    public record CreatePatientReq(Guid? LeadId, Guid? CustomerId, string FullName, string? Gender, string? DateOfBirth, string? Phone, string? Email, string? BloodGroup, string? AssignedDoctor, string? Notes);
    public record UpdatePatientReq(string FullName, string? Gender, string? DateOfBirth, string? Phone, string? Email, string? BloodGroup, string? AssignedDoctor, string Status, string? Notes);
    public record CreateApptReq(Guid PatientId, string PatientName, string Doctor, string? Department, string ScheduledAt, string? Reason, string? Notes);
    public record CreatePlanReq(Guid PatientId, string PatientName, string Diagnosis, string Plan, string Doctor, string StartDate, string? FollowUpDate, string? Notes);
    public record StatusReq(string Status);
}
