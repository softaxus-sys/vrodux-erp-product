using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.HR.API.Authorization;
using Softaxis.HR.API.Controllers.Common;
using Softaxis.HR.Application.Departments.Commands;
using Softaxis.HR.Application.Departments.Queries;

namespace Softaxis.HR.API.Controllers;

// Departments are HR reference data: GET reads feed the employee-form department dropdown, so they
// stay authenticated-only. Writes are gated on hr.employees.* (no dedicated departments permission key).
[Route("api/hr/departments")]
[Authorize]
public sealed class DepartmentsController(ISender sender) : HrControllerBase
{
    // ── Queries ───────────────────────────────────────────────────────────

    /// <summary>GET /api/hr/departments?search=&isActive=</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search   = null,
        [FromQuery] bool?   isActive = null,
        CancellationToken ct = default) =>
        OkOrError(await sender.Send(new GetDepartmentsQuery(search, isActive), ct));

    /// <summary>GET /api/hr/departments/{id}</summary>
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetDepartmentByIdQuery(id), ct));

    // ── Commands ──────────────────────────────────────────────────────────

    /// <summary>POST /api/hr/departments</summary>
    [HttpPost]
    [RequirePermission("hr.employees.create")]
    public async Task<IActionResult> Create([FromBody] CreateDepartmentCommand cmd, CancellationToken ct)
    {
        var result = await sender.Send(cmd, ct);
        return CreatedOrError(result, nameof(GetById),
            result.IsSuccess ? new { id = result.Value.Id } : null!);
    }

    /// <summary>PUT /api/hr/departments/{id}</summary>
    [HttpPut("{id:guid}")]
    [RequirePermission("hr.employees.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateDepartmentRequest req, CancellationToken ct) =>
        NoContentOrError(await sender.Send(
            new UpdateDepartmentCommand(id, req.Name, req.Code, req.Description, req.ManagerId, req.IsActive), ct));

    /// <summary>DELETE /api/hr/departments/{id}</summary>
    [HttpDelete("{id:guid}")]
    [RequirePermission("hr.employees.delete")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteDepartmentCommand(id), ct));

    // ── Request body records ─────────────────────────────────────────────

    public sealed record UpdateDepartmentRequest(
        string  Name,
        string? Code,
        string? Description,
        Guid?   ManagerId,
        bool    IsActive = true);
}
