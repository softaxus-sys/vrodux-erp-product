using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.HR.API.Authorization;
using Softaxis.HR.API.Controllers.Common;
using Softaxis.HR.Application.Employees.Commands;
using Softaxis.HR.Application.Employees.Queries;

namespace Softaxis.HR.API.Controllers;

[ApiController]
[Route("api/hr/employees")]
[Authorize]
public sealed class EmployeesController(ISender sender) : HrControllerBase
{
    public sealed record UpdateEmployeeRequest(
        string  FirstName,
        string  LastName,
        string  Email,
        string? Phone,
        string? JobTitle,
        Guid?   DepartmentId,
        string? DepartmentName,
        string  EmploymentType,
        decimal BasicSalary,
        string  JoiningDate,
        Guid?   ManagerId,
        string? Notes,
        string  Status,
        string? AvatarData = null,
        string? Nationality = null,
        string? EmiratesId = null,
        string? PassportNumber = null,
        string? VisaExpiry = null,
        string? ReportingTo = null,
        string? BankAccount = null,
        string? Iban = null,
        string? MedicalInsurance = null,
        string? LabourCardNumber = null,
        string? BankRoutingCode = null,
        bool    RemoveAvatar = false);

    public sealed record LinkUserRequest(Guid UserId);

    // ── GET /api/hr/employees/summary ───────────────────────────────────
    [HttpGet("summary")]
    [RequirePermission("hr.employees.view")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var result = await sender.Send(new GetEmployeesSummaryQuery(), ct);
        return OkOrError(result);
    }

    // ── GET /api/hr/employees ────────────────────────────────────────────
    [HttpGet]
    [RequirePermission("hr.employees.view")]
    public async Task<IActionResult> GetAll(
        [FromQuery] int     page           = 1,
        [FromQuery] int     pageSize       = 20,
        [FromQuery] string? search         = null,
        [FromQuery] string? status         = null,
        [FromQuery] string? employmentType = null,
        [FromQuery] Guid?   departmentId   = null,
        CancellationToken ct = default)
    {
        var result = await sender.Send(
            new GetEmployeesQuery(page, pageSize, search, status, employmentType, departmentId), ct);
        return OkOrError(result);
    }

    // ── GET /api/hr/employees/all ────────────────────────────────────────
    // Lightweight dropdown feed for the Leave / Payroll / Attendance forms, so it stays open to
    // users who can create those records but lack hr.employees.view.
    //
    // It was previously authenticated-only, which meant ANY signed-in user — including a
    // self-service employee with no HR access whatsoever — could read the full staff roster
    // together with every salary. It now requires one of the HR permissions that genuinely needs
    // the list, and the handler withholds the salary figure from callers not entitled to it.
    [HttpGet("all")]
    [RequireAnyPermission(
        "hr.employees.view", "hr.employees.create", "hr.employees.edit",
        "hr.leaves.view", "hr.leaves.create",
        "hr.attendance.view", "hr.attendance.create",
        "hr.payroll.view", "hr.payroll.create")]
    public async Task<IActionResult> GetAllSimple([FromQuery] bool includeInactive = false, CancellationToken ct = default)
    {
        var result = await sender.Send(new GetAllEmployeesSimpleQuery(includeInactive), ct);
        return OkOrError(result);
    }

    // ── GET /api/hr/employees/{id} ───────────────────────────────────────
    [HttpGet("{id:guid}")]
    [RequirePermission("hr.employees.view")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new GetEmployeeByIdQuery(id), ct);
        return OkOrError(result);
    }

    // ── POST /api/hr/employees ───────────────────────────────────────────
    [HttpPost]
    [RequirePermission("hr.employees.create")]
    public async Task<IActionResult> Create([FromBody] CreateEmployeeCommand command, CancellationToken ct)
    {
        var result = await sender.Send(command, ct);
        return CreatedOrError(result, nameof(GetById), new { id = result.IsSuccess ? (object?)result.Value.Id : null });
    }

    // ── PUT /api/hr/employees/{id} ───────────────────────────────────────
    [HttpPut("{id:guid}")]
    [RequirePermission("hr.employees.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateEmployeeRequest req, CancellationToken ct)
    {
        var result = await sender.Send(new UpdateEmployeeCommand(
            id, req.FirstName, req.LastName, req.Email, req.Phone,
            req.JobTitle, req.DepartmentId, req.DepartmentName,
            req.EmploymentType, req.BasicSalary, req.JoiningDate,
            req.ManagerId, req.Notes, req.Status, req.AvatarData,
            req.Nationality, req.EmiratesId, req.PassportNumber, req.VisaExpiry, req.ReportingTo,
            req.BankAccount, req.Iban, req.MedicalInsurance,
            req.LabourCardNumber, req.BankRoutingCode,
            // Named: the command grew two fields before this one, and passing it positionally
            // silently bound a bool to a string in the first attempt.
            RemoveAvatar: req.RemoveAvatar), ct);
        return NoContentOrError(result);
    }

    // ── GET /api/hr/employees/user-match?email= ──────────────────────────
    // Suggests a login that may be the same person. The caller confirms; nothing links here.
    [HttpGet("user-match")]
    [RequirePermission("hr.employees.edit")]
    public async Task<IActionResult> FindUserMatch([FromQuery] string email, CancellationToken ct)
    {
        var result = await sender.Send(new FindUserMatchQuery(email), ct);
        return OkOrError(result);
    }

    // ── POST /api/hr/employees/{id}/link-user ────────────────────────────
    [HttpPost("{id:guid}/link-user")]
    [RequirePermission("hr.employees.edit")]
    public async Task<IActionResult> LinkUser(Guid id, [FromBody] LinkUserRequest req, CancellationToken ct)
    {
        var result = await sender.Send(new LinkEmployeeUserCommand(id, req.UserId), ct);
        return NoContentOrError(result);
    }

    // ── DELETE /api/hr/employees/{id}/link-user ──────────────────────────
    [HttpDelete("{id:guid}/link-user")]
    [RequirePermission("hr.employees.edit")]
    public async Task<IActionResult> UnlinkUser(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new UnlinkEmployeeUserCommand(id), ct);
        return NoContentOrError(result);
    }

    // ── DELETE /api/hr/employees/{id} ────────────────────────────────────
    [HttpDelete("{id:guid}")]
    [RequirePermission("hr.employees.delete")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new DeleteEmployeeCommand(id), ct);
        return NoContentOrError(result);
    }
}
