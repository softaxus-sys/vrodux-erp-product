using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Softaxis.Construction.Domain.Entities;
using Softaxis.Construction.Infrastructure.Persistence;

namespace Softaxis.Construction.API.Controllers;

/// <summary>
/// CRM-linked construction bidding lifecycle: RFQs → Estimates → Contracts.
/// Each record references the core CRM Lead/Deal/Customer by ID (reuse, not duplication).
/// </summary>
[ApiController][Route("api/construction")][Authorize]
public sealed class ConstructionSalesController(ConstructionDbContext db) : ControllerBase
{
    [HttpGet("bidding/summary")]
    public async Task<IActionResult> Summary(CancellationToken ct)
    {
        var rfqs = await db.Rfqs.AsNoTracking().Select(x => x.Status).ToListAsync(ct);
        var est  = await db.Estimates.AsNoTracking().Select(x => new { x.Status, x.Amount }).ToListAsync(ct);
        var con  = await db.Contracts.AsNoTracking().Select(x => new { x.Status, x.ContractValue }).ToListAsync(ct);
        return Ok(new
        {
            openRfqs       = rfqs.Count(s => s == "open"),
            totalRfqs      = rfqs.Count,
            pendingEstimates = est.Count(x => x.Status is "draft" or "sent"),
            estimatedValue = est.Sum(x => x.Amount),
            activeContracts= con.Count(x => x.Status == "active"),
            contractValue  = con.Where(x => x.Status is "active" or "completed").Sum(x => x.ContractValue),
        });
    }

    // ── RFQs ──────────────────────────────────────────────────────────────────
    [HttpGet("rfqs")]
    public async Task<IActionResult> GetRfqs(CancellationToken ct) =>
        Ok((await db.Rfqs.AsNoTracking().OrderByDescending(x => x.CreatedAt).ToListAsync(ct)).Select(RfqDto));

    [HttpPost("rfqs")]
    public async Task<IActionResult> CreateRfq([FromBody] CreateRfqReq r, CancellationToken ct)
    {
        var e = new Rfq(r.LeadId, r.CustomerId, r.ClientName, r.ProjectTitle, r.Scope, r.Budget, r.DueDate, r.AssignedTo ?? "", r.Notes);
        db.Rfqs.Add(e); await db.SaveChangesAsync(ct); return Ok(RfqDto(e));
    }

    [HttpPatch("rfqs/{id:guid}/status")]
    public async Task<IActionResult> RfqStatus(Guid id, [FromBody] StatusReq r, CancellationToken ct)
    { var e = await db.Rfqs.FindAsync([id], ct); if (e is null) return NotFound(); e.SetStatus(r.Status); await db.SaveChangesAsync(ct); return NoContent(); }

    [HttpDelete("rfqs/{id:guid}")]
    public async Task<IActionResult> DeleteRfq(Guid id, CancellationToken ct)
    { var e = await db.Rfqs.FindAsync([id], ct); if (e is null) return NotFound(); e.Delete(); await db.SaveChangesAsync(ct); return NoContent(); }

    // ── Estimates ─────────────────────────────────────────────────────────────
    [HttpGet("estimates")]
    public async Task<IActionResult> GetEstimates(CancellationToken ct) =>
        Ok((await db.Estimates.AsNoTracking().OrderByDescending(x => x.CreatedAt).ToListAsync(ct)).Select(EstDto));

    [HttpPost("estimates")]
    public async Task<IActionResult> CreateEstimate([FromBody] CreateEstimateReq r, CancellationToken ct)
    {
        var e = new Estimate(r.RfqId, r.DealId, r.CustomerId, r.ClientName, r.Title, r.Amount, r.ValidUntil, r.Notes);
        db.Estimates.Add(e);
        if (r.RfqId is { } rid) { var rfq = await db.Rfqs.FindAsync([rid], ct); rfq?.SetStatus("quoted"); }
        await db.SaveChangesAsync(ct); return Ok(EstDto(e));
    }

    [HttpPatch("estimates/{id:guid}/status")]
    public async Task<IActionResult> EstStatus(Guid id, [FromBody] StatusReq r, CancellationToken ct)
    { var e = await db.Estimates.FindAsync([id], ct); if (e is null) return NotFound(); e.SetStatus(r.Status); await db.SaveChangesAsync(ct); return NoContent(); }

    [HttpDelete("estimates/{id:guid}")]
    public async Task<IActionResult> DeleteEstimate(Guid id, CancellationToken ct)
    { var e = await db.Estimates.FindAsync([id], ct); if (e is null) return NotFound(); e.Delete(); await db.SaveChangesAsync(ct); return NoContent(); }

    // ── Contracts ─────────────────────────────────────────────────────────────
    [HttpGet("contracts")]
    public async Task<IActionResult> GetContracts(CancellationToken ct) =>
        Ok((await db.Contracts.AsNoTracking().OrderByDescending(x => x.CreatedAt).ToListAsync(ct)).Select(ConDto));

    [HttpPost("contracts")]
    public async Task<IActionResult> CreateContract([FromBody] CreateContractReq r, CancellationToken ct)
    {
        var c = new ConstructionContract(r.DealId, r.CustomerId, r.EstimateId, r.ClientName, r.Title, r.ContractValue, r.StartDate, r.EndDate, r.Contractor, r.Notes);
        db.Contracts.Add(c);
        if (r.EstimateId is { } eid) { var est = await db.Estimates.FindAsync([eid], ct); est?.SetStatus("approved"); }
        await db.SaveChangesAsync(ct); return Ok(ConDto(c));
    }

    [HttpPatch("contracts/{id:guid}/status")]
    public async Task<IActionResult> ConStatus(Guid id, [FromBody] StatusReq r, CancellationToken ct)
    { var c = await db.Contracts.FindAsync([id], ct); if (c is null) return NotFound(); c.SetStatus(r.Status); await db.SaveChangesAsync(ct); return NoContent(); }

    [HttpDelete("contracts/{id:guid}")]
    public async Task<IActionResult> DeleteContract(Guid id, CancellationToken ct)
    { var c = await db.Contracts.FindAsync([id], ct); if (c is null) return NotFound(); c.Delete(); await db.SaveChangesAsync(ct); return NoContent(); }

    private static object RfqDto(Rfq x) => new { x.Id, x.RfqNumber, x.LeadId, x.CustomerId, x.ClientName, x.ProjectTitle, x.Scope, x.Budget, x.DueDate, x.Status, x.AssignedTo, x.Notes, x.CreatedAt };
    private static object EstDto(Estimate x) => new { x.Id, x.EstimateNumber, x.RfqId, x.DealId, x.CustomerId, x.ClientName, x.Title, x.Amount, x.ValidUntil, x.Status, x.Notes, x.CreatedAt };
    private static object ConDto(ConstructionContract x) => new { x.Id, x.ContractNumber, x.DealId, x.CustomerId, x.EstimateId, x.ProjectId, x.ClientName, x.Title, x.ContractValue, x.StartDate, x.EndDate, x.Status, x.Contractor, x.Notes, x.CreatedAt };

    public record CreateRfqReq(Guid? LeadId, Guid? CustomerId, string ClientName, string ProjectTitle, string? Scope, decimal? Budget, string DueDate, string? AssignedTo, string? Notes);
    public record CreateEstimateReq(Guid? RfqId, Guid? DealId, Guid? CustomerId, string ClientName, string Title, decimal Amount, string ValidUntil, string? Notes);
    public record CreateContractReq(Guid? DealId, Guid? CustomerId, Guid? EstimateId, string ClientName, string Title, decimal ContractValue, string StartDate, string EndDate, string? Contractor, string? Notes);
    public record StatusReq(string Status);
}
