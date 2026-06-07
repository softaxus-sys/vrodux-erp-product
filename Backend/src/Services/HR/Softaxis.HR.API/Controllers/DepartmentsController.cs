using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Softaxis.HR.Domain.Entities;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.API.Controllers;

[ApiController]
[Route("api/hr/departments")]
[Authorize]
public sealed class DepartmentsController(HrDbContext db) : ControllerBase
{
    // ── DTOs ─────────────────────────────────────────────────────────────
    public record DepartmentDto(
        Guid      Id,
        string    Name,
        string?   Code,
        string?   Description,
        Guid?     ManagerId,
        bool      IsActive,
        int       EmployeeCount,
        DateTime  CreatedAt,
        DateTime? UpdatedAt);

    public record UpsertDepartmentRequest(
        string  Name,
        string? Code,
        string? Description,
        Guid?   ManagerId,
        bool    IsActive = true);

    // ── GET /api/hr/departments ──────────────────────────────────────────
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search   = null,
        [FromQuery] bool?   isActive = null,
        CancellationToken ct = default)
    {
        IQueryable<Department> query = db.Departments.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(x => x.Name.Contains(search) ||
                                     (x.Code != null && x.Code.Contains(search)));

        if (isActive.HasValue)
            query = query.Where(x => x.IsActive == isActive.Value);

        var items = await query
            .OrderBy(x => x.Name)
            .Select(x => new DepartmentDto(
                x.Id, x.Name, x.Code, x.Description, x.ManagerId, x.IsActive,
                x.Employees.Count(e => !e.IsDeleted && e.Status != "terminated"),
                x.CreatedAt, x.UpdatedAt))
            .ToListAsync(ct);

        return Ok(items);
    }

    // ── GET /api/hr/departments/{id} ─────────────────────────────────────
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var dept = await db.Departments
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new DepartmentDto(
                x.Id, x.Name, x.Code, x.Description, x.ManagerId, x.IsActive,
                x.Employees.Count(e => !e.IsDeleted && e.Status != "terminated"),
                x.CreatedAt, x.UpdatedAt))
            .FirstOrDefaultAsync(ct);

        return dept is null ? NotFound() : Ok(dept);
    }

    // ── POST /api/hr/departments ─────────────────────────────────────────
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] UpsertDepartmentRequest req, CancellationToken ct)
    {
        var dept = new Department(req.Name, req.Code, req.Description);
        if (!req.IsActive || req.ManagerId.HasValue)
            dept.Update(req.Name, req.Code, req.Description, req.ManagerId, req.IsActive);

        db.Departments.Add(dept);
        await db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetById), new { id = dept.Id },
            new DepartmentDto(dept.Id, dept.Name, dept.Code, dept.Description,
                dept.ManagerId, dept.IsActive, 0, dept.CreatedAt, dept.UpdatedAt));
    }

    // ── PUT /api/hr/departments/{id} ─────────────────────────────────────
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpsertDepartmentRequest req, CancellationToken ct)
    {
        var dept = await db.Departments.FindAsync([id], ct);
        if (dept is null) return NotFound();

        dept.Update(req.Name, req.Code, req.Description, req.ManagerId, req.IsActive);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ── DELETE /api/hr/departments/{id} ─────────────────────────────────
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var dept = await db.Departments.FindAsync([id], ct);
        if (dept is null) return NotFound();
        dept.Delete();
        await db.SaveChangesAsync(ct);
        return NoContent();
    }
}
