using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Softaxis.CRM.Domain.Entities;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.API.Controllers;

/// <summary>
/// Education pack: Admissions → Students → Enrollments (with fee tracking).
/// Admissions/students extend CRM leads/customers — reuse, not duplication.
/// </summary>
[ApiController][Route("api/education")][Authorize]
public sealed class EducationController(CrmDbContext db) : ControllerBase
{
    [HttpGet("summary")]
    public async Task<IActionResult> Summary(CancellationToken ct)
    {
        var adm = await db.Admissions.AsNoTracking().Select(x => x.Status).ToListAsync(ct);
        var students = await db.Students.AsNoTracking().CountAsync(x => x.Status == "enrolled");
        var enr = await db.Enrollments.AsNoTracking().Select(x => new { x.FeeTotal, x.FeePaid }).ToListAsync(ct);
        return Ok(new
        {
            openInquiries  = adm.Count(s => s is "inquiry" or "applied" or "offer"),
            totalAdmissions= adm.Count,
            enrolledStudents = students,
            activeEnrollments = enr.Count,
            feesBilled     = enr.Sum(x => x.FeeTotal),
            feesCollected  = enr.Sum(x => x.FeePaid),
            feesOutstanding= enr.Sum(x => Math.Max(0, x.FeeTotal - x.FeePaid)),
        });
    }

    // ── Admissions ────────────────────────────────────────────────────────────
    [HttpGet("admissions")]
    public async Task<IActionResult> GetAdmissions(CancellationToken ct) =>
        Ok((await db.Admissions.AsNoTracking().OrderByDescending(x => x.CreatedAt).ToListAsync(ct)).Select(AdmDto));

    [HttpPost("admissions")]
    public async Task<IActionResult> CreateAdmission([FromBody] CreateAdmissionReq r, CancellationToken ct)
    {
        var a = new Admission(r.LeadId, r.ApplicantName, r.Program, r.IntakeTerm ?? "", r.GuardianName, r.Phone, r.Email, r.Notes);
        db.Admissions.Add(a); await db.SaveChangesAsync(ct); return Ok(AdmDto(a));
    }

    [HttpPatch("admissions/{id:guid}/status")]
    public async Task<IActionResult> AdmStatus(Guid id, [FromBody] StatusReq r, CancellationToken ct)
    { var a = await db.Admissions.FindAsync([id], ct); if (a is null) return NotFound(); a.SetStatus(r.Status); await db.SaveChangesAsync(ct); return NoContent(); }

    /// <summary>Convert an accepted admission into an enrolled student.</summary>
    [HttpPost("admissions/{id:guid}/enroll")]
    public async Task<IActionResult> EnrollAdmission(Guid id, CancellationToken ct)
    {
        var a = await db.Admissions.FindAsync([id], ct); if (a is null) return NotFound();
        var student = new Student(null, a.ApplicantName, "", a.Program, a.GuardianName, a.Phone, a.Email, a.Notes);
        db.Students.Add(student);
        a.LinkStudent(student.Id);
        await db.SaveChangesAsync(ct);
        return Ok(new { studentId = student.Id, student.StudentNumber });
    }

    [HttpDelete("admissions/{id:guid}")]
    public async Task<IActionResult> DeleteAdmission(Guid id, CancellationToken ct)
    { var a = await db.Admissions.FindAsync([id], ct); if (a is null) return NotFound(); a.Delete(); await db.SaveChangesAsync(ct); return NoContent(); }

    // ── Students ──────────────────────────────────────────────────────────────
    [HttpGet("students")]
    public async Task<IActionResult> GetStudents(CancellationToken ct) =>
        Ok((await db.Students.AsNoTracking().OrderByDescending(x => x.CreatedAt).ToListAsync(ct)).Select(StuDto));

    [HttpPost("students")]
    public async Task<IActionResult> CreateStudent([FromBody] CreateStudentReq r, CancellationToken ct)
    {
        var s = new Student(r.CustomerId, r.FullName, r.Gender ?? "", r.Program ?? "", r.GuardianName, r.Phone, r.Email, r.Notes);
        db.Students.Add(s); await db.SaveChangesAsync(ct); return Ok(StuDto(s));
    }

    [HttpDelete("students/{id:guid}")]
    public async Task<IActionResult> DeleteStudent(Guid id, CancellationToken ct)
    { var s = await db.Students.FindAsync([id], ct); if (s is null) return NotFound(); s.Delete(); await db.SaveChangesAsync(ct); return NoContent(); }

    // ── Enrollments ───────────────────────────────────────────────────────────
    [HttpGet("enrollments")]
    public async Task<IActionResult> GetEnrollments([FromQuery] Guid? studentId, CancellationToken ct)
    {
        var q = db.Enrollments.AsNoTracking().AsQueryable();
        if (studentId.HasValue) q = q.Where(x => x.StudentId == studentId.Value);
        return Ok((await q.OrderByDescending(x => x.CreatedAt).ToListAsync(ct)).Select(EnrDto));
    }

    [HttpPost("enrollments")]
    public async Task<IActionResult> CreateEnrollment([FromBody] CreateEnrollmentReq r, CancellationToken ct)
    {
        var e = new Enrollment(r.StudentId, r.StudentName, r.Course, r.Term ?? "", r.FeeTotal, r.Notes);
        db.Enrollments.Add(e); await db.SaveChangesAsync(ct); return Ok(EnrDto(e));
    }

    [HttpPost("enrollments/{id:guid}/payment")]
    public async Task<IActionResult> RecordFee(Guid id, [FromBody] PaymentReq r, CancellationToken ct)
    { var e = await db.Enrollments.FindAsync([id], ct); if (e is null) return NotFound(); e.RecordPayment(r.Amount); await db.SaveChangesAsync(ct); return Ok(EnrDto(e)); }

    [HttpPatch("enrollments/{id:guid}/status")]
    public async Task<IActionResult> EnrStatus(Guid id, [FromBody] StatusReq r, CancellationToken ct)
    { var e = await db.Enrollments.FindAsync([id], ct); if (e is null) return NotFound(); e.SetStatus(r.Status); await db.SaveChangesAsync(ct); return NoContent(); }

    [HttpDelete("enrollments/{id:guid}")]
    public async Task<IActionResult> DeleteEnrollment(Guid id, CancellationToken ct)
    { var e = await db.Enrollments.FindAsync([id], ct); if (e is null) return NotFound(); e.Delete(); await db.SaveChangesAsync(ct); return NoContent(); }

    private static object AdmDto(Admission a) => new { a.Id, a.AdmissionNumber, a.LeadId, a.StudentId, a.ApplicantName, a.Program, a.IntakeTerm, a.GuardianName, a.Phone, a.Email, a.Status, a.AppliedDate, a.Notes, a.CreatedAt };
    private static object StuDto(Student s) => new { s.Id, s.StudentNumber, s.CustomerId, s.FullName, s.Gender, s.Program, s.GuardianName, s.Phone, s.Email, s.Status, s.EnrolledDate, s.Notes, s.CreatedAt };
    private static object EnrDto(Enrollment e) => new { e.Id, e.EnrollmentNumber, e.StudentId, e.StudentName, e.Course, e.Term, e.FeeTotal, e.FeePaid, e.FeeBalance, e.Status, e.EnrollDate, e.Notes, e.CreatedAt };

    public record CreateAdmissionReq(Guid? LeadId, string ApplicantName, string Program, string? IntakeTerm, string? GuardianName, string? Phone, string? Email, string? Notes);
    public record CreateStudentReq(Guid? CustomerId, string FullName, string? Gender, string? Program, string? GuardianName, string? Phone, string? Email, string? Notes);
    public record CreateEnrollmentReq(Guid StudentId, string StudentName, string Course, string? Term, decimal FeeTotal, string? Notes);
    public record StatusReq(string Status);
    public record PaymentReq(decimal Amount);
}
