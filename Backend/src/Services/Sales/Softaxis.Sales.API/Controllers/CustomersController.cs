using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Softaxis.Sales.Domain.Entities;
using Softaxis.Sales.Infrastructure.Persistence;

namespace Softaxis.Sales.API.Controllers;

[ApiController]
[Route("api/sales/customers")]
[Authorize]
public sealed class CustomersController(SalesDbContext db) : ControllerBase
{
    public record CustomerDto(
        Guid    Id,
        string  Name,
        string? Email,
        string? Phone,
        string? Address,
        string? TaxNumber,
        string? Notes,
        bool    IsActive,
        int     OrderCount,
        int     QuotationCount,
        DateTime CreatedAt,
        DateTime? UpdatedAt);

    public record UpsertCustomerRequest(
        string  Name,
        string? Email,
        string? Phone,
        string? Address,
        string? TaxNumber,
        string? Notes,
        bool    IsActive = true);

    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search   = null,
        [FromQuery] bool?   isActive = null,
        CancellationToken ct = default)
    {
        IQueryable<Customer> query = db.Customers.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(x => x.Name.Contains(search) ||
                                     (x.Email != null && x.Email.Contains(search)) ||
                                     (x.Phone != null && x.Phone.Contains(search)));

        if (isActive.HasValue)
            query = query.Where(x => x.IsActive == isActive.Value);

        var items = await query
            .OrderBy(x => x.Name)
            .Select(x => new CustomerDto(
                x.Id, x.Name, x.Email, x.Phone, x.Address, x.TaxNumber, x.Notes, x.IsActive,
                x.SalesOrders.Count(o => !o.IsDeleted),
                x.SalesQuotations.Count(q => !q.IsDeleted),
                x.CreatedAt, x.UpdatedAt))
            .ToListAsync(ct);

        return Ok(items);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var c = await db.Customers
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new CustomerDto(
                x.Id, x.Name, x.Email, x.Phone, x.Address, x.TaxNumber, x.Notes, x.IsActive,
                x.SalesOrders.Count(o => !o.IsDeleted),
                x.SalesQuotations.Count(q => !q.IsDeleted),
                x.CreatedAt, x.UpdatedAt))
            .FirstOrDefaultAsync(ct);

        return c is null ? NotFound() : Ok(c);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] UpsertCustomerRequest req, CancellationToken ct)
    {
        var customer = new Customer(req.Name, req.Email, req.Phone, req.Address, req.TaxNumber, req.Notes);
        if (!req.IsActive)
            customer.Update(req.Name, req.Email, req.Phone, req.Address, req.TaxNumber, req.Notes, false);

        db.Customers.Add(customer);
        await db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetById), new { id = customer.Id },
            new CustomerDto(customer.Id, customer.Name, customer.Email, customer.Phone,
                customer.Address, customer.TaxNumber, customer.Notes, customer.IsActive,
                0, 0, customer.CreatedAt, customer.UpdatedAt));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpsertCustomerRequest req, CancellationToken ct)
    {
        var customer = await db.Customers.FindAsync([id], ct);
        if (customer is null) return NotFound();

        customer.Update(req.Name, req.Email, req.Phone, req.Address, req.TaxNumber, req.Notes, req.IsActive);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var customer = await db.Customers.FindAsync([id], ct);
        if (customer is null) return NotFound();
        customer.Delete();
        await db.SaveChangesAsync(ct);
        return NoContent();
    }
}
