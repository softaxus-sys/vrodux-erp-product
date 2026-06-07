using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Softaxis.CRM.Domain.Entities;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.API.Controllers;

/// <summary>
/// B2B Services pack: Proposals → Service Contracts (AMC/SLA/Retainer) → Support Tickets.
/// Customers are CRM customers, opportunities are CRM deals — reuse, not duplication.
/// </summary>
[ApiController][Route("api/b2b")][Authorize]
public sealed class B2BController(CrmDbContext db) : ControllerBase
{
    [HttpGet("summary")]
    public async Task<IActionResult> Summary(CancellationToken ct)
    {
        var prop = await db.Proposals.AsNoTracking().Select(x => new { x.Status, x.Amount }).ToListAsync(ct);
        var con  = await db.ServiceContracts.AsNoTracking().Select(x => new { x.Status, x.Value, x.ContractType }).ToListAsync(ct);
        var tkt  = await db.SupportTickets.AsNoTracking().Select(x => new { x.Status, x.Priority }).ToListAsync(ct);
        return Ok(new
        {
            openProposals     = prop.Count(x => x.Status is "draft" or "sent"),
            proposalsValue    = prop.Where(x => x.Status is "draft" or "sent").Sum(x => x.Amount),
            activeContracts   = con.Count(x => x.Status == "active"),
            recurringRevenue  = con.Where(x => x.Status == "active" && x.ContractType is "amc" or "retainer" or "sla").Sum(x => x.Value),
            openTickets       = tkt.Count(x => x.Status is "open" or "in_progress"),
            criticalTickets   = tkt.Count(x => x.Status is "open" or "in_progress" && x.Priority == "critical"),
            resolvedTickets   = tkt.Count(x => x.Status is "resolved" or "closed"),
        });
    }

    // ── Proposals ─────────────────────────────────────────────────────────────
    [HttpGet("proposals")]
    public async Task<IActionResult> GetProposals(CancellationToken ct) =>
        Ok((await db.Proposals.AsNoTracking().OrderByDescending(x => x.CreatedAt).ToListAsync(ct)).Select(PropDto));

    [HttpPost("proposals")]
    public async Task<IActionResult> CreateProposal([FromBody] CreateProposalReq r, CancellationToken ct)
    {
        var p = new Proposal(r.LeadId, r.DealId, r.CustomerId, r.ClientName, r.Title, r.Amount, r.ValidUntil, r.Scope, r.Notes);
        db.Proposals.Add(p); await db.SaveChangesAsync(ct); return Ok(PropDto(p));
    }

    [HttpPatch("proposals/{id:guid}/status")]
    public async Task<IActionResult> ProposalStatus(Guid id, [FromBody] StatusReq r, CancellationToken ct)
    { var p = await db.Proposals.FindAsync([id], ct); if (p is null) return NotFound(); p.SetStatus(r.Status); await db.SaveChangesAsync(ct); return NoContent(); }

    [HttpDelete("proposals/{id:guid}")]
    public async Task<IActionResult> DeleteProposal(Guid id, CancellationToken ct)
    { var p = await db.Proposals.FindAsync([id], ct); if (p is null) return NotFound(); p.Delete(); await db.SaveChangesAsync(ct); return NoContent(); }

    // ── Service Contracts ─────────────────────────────────────────────────────
    [HttpGet("contracts")]
    public async Task<IActionResult> GetContracts(CancellationToken ct) =>
        Ok((await db.ServiceContracts.AsNoTracking().OrderByDescending(x => x.CreatedAt).ToListAsync(ct)).Select(ConDto));

    [HttpPost("contracts")]
    public async Task<IActionResult> CreateContract([FromBody] CreateContractReq r, CancellationToken ct)
    {
        var c = new ServiceContract(r.ProposalId, r.DealId, r.CustomerId, r.ClientName, r.Title, r.ContractType, r.Value, r.StartDate, r.EndDate, r.SlaTier, r.Notes);
        db.ServiceContracts.Add(c);
        if (r.ProposalId is { } pid) { var prop = await db.Proposals.FindAsync([pid], ct); prop?.SetStatus("accepted"); }
        await db.SaveChangesAsync(ct);
        return Ok(ConDto(c));
    }

    [HttpPatch("contracts/{id:guid}/status")]
    public async Task<IActionResult> ContractStatus(Guid id, [FromBody] StatusReq r, CancellationToken ct)
    { var c = await db.ServiceContracts.FindAsync([id], ct); if (c is null) return NotFound(); c.SetStatus(r.Status); await db.SaveChangesAsync(ct); return NoContent(); }

    [HttpDelete("contracts/{id:guid}")]
    public async Task<IActionResult> DeleteContract(Guid id, CancellationToken ct)
    { var c = await db.ServiceContracts.FindAsync([id], ct); if (c is null) return NotFound(); c.Delete(); await db.SaveChangesAsync(ct); return NoContent(); }

    // ── Support Tickets ───────────────────────────────────────────────────────
    [HttpGet("tickets")]
    public async Task<IActionResult> GetTickets(CancellationToken ct) =>
        Ok((await db.SupportTickets.AsNoTracking().OrderByDescending(x => x.CreatedAt).ToListAsync(ct)).Select(TkDto));

    [HttpPost("tickets")]
    public async Task<IActionResult> CreateTicket([FromBody] CreateTicketReq r, CancellationToken ct)
    {
        var t = new SupportTicket(r.ContractId, r.CustomerId, r.ClientName, r.Subject, r.Priority ?? "medium", r.Description);
        db.SupportTickets.Add(t); await db.SaveChangesAsync(ct); return Ok(TkDto(t));
    }

    [HttpPost("tickets/{id:guid}/resolve")]
    public async Task<IActionResult> Resolve(Guid id, [FromBody] ResolveReq r, CancellationToken ct)
    { var t = await db.SupportTickets.FindAsync([id], ct); if (t is null) return NotFound(); t.Resolve(r.Resolution); await db.SaveChangesAsync(ct); return NoContent(); }

    [HttpPatch("tickets/{id:guid}/status")]
    public async Task<IActionResult> TicketStatus(Guid id, [FromBody] StatusReq r, CancellationToken ct)
    { var t = await db.SupportTickets.FindAsync([id], ct); if (t is null) return NotFound(); t.SetStatus(r.Status); await db.SaveChangesAsync(ct); return NoContent(); }

    [HttpDelete("tickets/{id:guid}")]
    public async Task<IActionResult> DeleteTicket(Guid id, CancellationToken ct)
    { var t = await db.SupportTickets.FindAsync([id], ct); if (t is null) return NotFound(); t.Delete(); await db.SaveChangesAsync(ct); return NoContent(); }

    private static object PropDto(Proposal p) => new { p.Id, p.ProposalNumber, p.LeadId, p.DealId, p.CustomerId, p.ClientName, p.Title, p.Amount, p.ValidUntil, p.Status, p.Scope, p.Notes, p.CreatedAt };
    private static object ConDto(ServiceContract c) => new { c.Id, c.ContractNumber, c.ProposalId, c.DealId, c.CustomerId, c.ClientName, c.Title, c.ContractType, c.Value, c.StartDate, c.EndDate, c.Status, c.SlaTier, c.Notes, c.CreatedAt };
    private static object TkDto(SupportTicket t) => new { t.Id, t.TicketNumber, t.ContractId, t.CustomerId, t.ClientName, t.Subject, t.Priority, t.Status, t.Description, t.Resolution, t.CreatedAt };

    public record CreateProposalReq(Guid? LeadId, Guid? DealId, Guid? CustomerId, string ClientName, string Title, decimal Amount, string ValidUntil, string? Scope, string? Notes);
    public record CreateContractReq(Guid? ProposalId, Guid? DealId, Guid? CustomerId, string ClientName, string Title, string ContractType, decimal Value, string StartDate, string EndDate, string? SlaTier, string? Notes);
    public record CreateTicketReq(Guid? ContractId, Guid? CustomerId, string ClientName, string Subject, string? Priority, string? Description);
    public record ResolveReq(string? Resolution);
    public record StatusReq(string Status);
}
