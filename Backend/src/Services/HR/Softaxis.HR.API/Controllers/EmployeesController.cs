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
        string  Status);

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
    // Lightweight dropdown feed consumed by Leave/Payroll/Attendance forms across HR —
    // left authenticated-only (not gated) so those forms work for users who can create
    // leaves/payroll but lack hr.employees.view (shared reference, like Finance lookups).
    [HttpGet("all")]
    public async Task<IActionResult> GetAllSimple(CancellationToken ct)
    {
        var result = await sender.Send(new GetAllEmployeesSimpleQuery(), ct);
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
        return CreatedOrError(result, nameof(GetById), new { id = result.Value?.Id });
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
            req.ManagerId, req.Notes, req.Status), ct);
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
