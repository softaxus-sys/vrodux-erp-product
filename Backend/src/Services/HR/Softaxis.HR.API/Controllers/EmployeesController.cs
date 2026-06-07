using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Softaxis.HR.Domain.Entities;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.API.Controllers;

[ApiController]
[Route("api/hr/employees")]
[Authorize]
public sealed class EmployeesController(HrDbContext db) : ControllerBase
{
    // ── DTOs ─────────────────────────────────────────────────────────────
    public record EmployeeDto(
        Guid      Id,
        string    EmployeeNumber,
        string    FirstName,
        string    LastName,
        string    FullName,
        string    Email,
        string?   Phone,
        string?   JobTitle,
        Guid?     DepartmentId,
        string?   DepartmentName,
        string    EmploymentType,
        decimal   BasicSalary,
        string    JoiningDate,
        string?   TerminationDate,
        string    Status,
        Guid?     ManagerId,
        string?   Notes,
        DateTime  CreatedAt,
        DateTime? UpdatedAt);

    public record CreateEmployeeRequest(
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
        string? Notes);

    public record UpdateEmployeeRequest(
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

    public record PagedResult<T>(
        IReadOnlyList<T> Items,
        int Page,
        int PageSize,
        int TotalCount,
        int TotalPages,
        bool HasNext,
        bool HasPrev);

    // ── GET /api/hr/employees/summary ───────────────────────────────────
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var joiningThisMonthPrefix = DateTime.UtcNow.ToString("yyyy-MM");

        var statusCounts = await db.Employees
            .AsNoTracking()
            .GroupBy(x => x.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        var total      = statusCounts.Sum(c => c.Count);
        var active     = statusCounts.FirstOrDefault(c => c.Status == "active")?.Count     ?? 0;
        var inactive   = statusCounts.FirstOrDefault(c => c.Status == "inactive")?.Count   ?? 0;
        var terminated = statusCounts.FirstOrDefault(c => c.Status == "terminated")?.Count ?? 0;

        var newHiresThisMonth = await db.Employees
            .AsNoTracking()
            .CountAsync(x => x.JoiningDate.StartsWith(joiningThisMonthPrefix), ct);

        var byDepartment = await db.Employees
            .AsNoTracking()
            .Where(x => x.Status == "active" && x.DepartmentName != null)
            .GroupBy(x => x.DepartmentName!)
            .Select(g => new { Department = g.Key, Count = g.Count() })
            .OrderByDescending(g => g.Count)
            .Take(10)
            .ToListAsync(ct);

        return Ok(new
        {
            Total             = total,
            Active            = active,
            Inactive          = inactive,
            Terminated        = terminated,
            NewHiresThisMonth = newHiresThisMonth,
            ByDepartment      = byDepartment
        });
    }

    // ── GET /api/hr/employees ────────────────────────────────────────────
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] int     page           = 1,
        [FromQuery] int     pageSize       = 20,
        [FromQuery] string? search         = null,
        [FromQuery] string? status         = null,
        [FromQuery] string? employmentType = null,
        [FromQuery] Guid?   departmentId   = null,
        CancellationToken ct = default)
    {
        IQueryable<Employee> query = db.Employees.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(x =>
                x.FirstName.Contains(search) ||
                x.LastName.Contains(search)  ||
                x.Email.Contains(search)     ||
                x.EmployeeNumber.Contains(search) ||
                (x.JobTitle != null && x.JobTitle.Contains(search)));

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(x => x.Status == status);

        if (!string.IsNullOrWhiteSpace(employmentType))
            query = query.Where(x => x.EmploymentType == employmentType);

        if (departmentId.HasValue)
            query = query.Where(x => x.DepartmentId == departmentId.Value);

        var total      = await query.CountAsync(ct);
        var totalPages = (int)Math.Ceiling((double)total / pageSize);

        var items = await query
            .OrderBy(x => x.FirstName).ThenBy(x => x.LastName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new EmployeeDto(
                x.Id, x.EmployeeNumber, x.FirstName, x.LastName,
                x.FirstName + " " + x.LastName,
                x.Email, x.Phone, x.JobTitle, x.DepartmentId, x.DepartmentName,
                x.EmploymentType, x.BasicSalary, x.JoiningDate, x.TerminationDate,
                x.Status, x.ManagerId, x.Notes, x.CreatedAt, x.UpdatedAt))
            .ToListAsync(ct);

        return Ok(new PagedResult<EmployeeDto>(items, page, pageSize, total, totalPages,
            page < totalPages, page > 1));
    }

    // ── GET /api/hr/employees/all ────────────────────────────────────────
    // Returns up to 500 active employees for dropdowns (no pagination)
    [HttpGet("all")]
    public async Task<IActionResult> GetAllSimple(CancellationToken ct)
    {
        var items = await db.Employees
            .AsNoTracking()
            .Where(x => x.Status == "active")
            .OrderBy(x => x.FirstName).ThenBy(x => x.LastName)
            .Take(500)
            .Select(x => new
            {
                x.Id,
                x.EmployeeNumber,
                FullName = x.FirstName + " " + x.LastName,
                x.JobTitle,
                x.DepartmentName,
                x.BasicSalary
            })
            .ToListAsync(ct);

        return Ok(items);
    }

    // ── GET /api/hr/employees/{id} ───────────────────────────────────────
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var emp = await db.Employees
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new EmployeeDto(
                x.Id, x.EmployeeNumber, x.FirstName, x.LastName,
                x.FirstName + " " + x.LastName,
                x.Email, x.Phone, x.JobTitle, x.DepartmentId, x.DepartmentName,
                x.EmploymentType, x.BasicSalary, x.JoiningDate, x.TerminationDate,
                x.Status, x.ManagerId, x.Notes, x.CreatedAt, x.UpdatedAt))
            .FirstOrDefaultAsync(ct);

        return emp is null ? NotFound() : Ok(emp);
    }

    // ── POST /api/hr/employees ───────────────────────────────────────────
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateEmployeeRequest req, CancellationToken ct)
    {
        var employee = new Employee(
            req.FirstName, req.LastName, req.Email, req.Phone,
            req.JobTitle, req.DepartmentId, req.DepartmentName,
            req.EmploymentType, req.BasicSalary, req.JoiningDate,
            req.ManagerId, req.Notes);

        db.Employees.Add(employee);
        await db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetById), new { id = employee.Id },
            new EmployeeDto(
                employee.Id, employee.EmployeeNumber, employee.FirstName, employee.LastName,
                employee.FullName, employee.Email, employee.Phone, employee.JobTitle,
                employee.DepartmentId, employee.DepartmentName, employee.EmploymentType,
                employee.BasicSalary, employee.JoiningDate, employee.TerminationDate,
                employee.Status, employee.ManagerId, employee.Notes,
                employee.CreatedAt, employee.UpdatedAt));
    }

    // ── PUT /api/hr/employees/{id} ───────────────────────────────────────
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateEmployeeRequest req, CancellationToken ct)
    {
        var employee = await db.Employees.FindAsync([id], ct);
        if (employee is null) return NotFound();

        employee.Update(
            req.FirstName, req.LastName, req.Email, req.Phone,
            req.JobTitle, req.DepartmentId, req.DepartmentName,
            req.EmploymentType, req.BasicSalary, req.JoiningDate,
            req.ManagerId, req.Notes, req.Status);

        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ── DELETE /api/hr/employees/{id} ────────────────────────────────────
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var employee = await db.Employees.FindAsync([id], ct);
        if (employee is null) return NotFound();
        employee.Delete();
        await db.SaveChangesAsync(ct);
        return NoContent();
    }
}
