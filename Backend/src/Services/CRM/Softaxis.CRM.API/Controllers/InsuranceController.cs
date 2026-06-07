using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Softaxis.CRM.Domain.Entities;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.API.Controllers;

/// <summary>
/// Insurance pack: Policies → Renewals → Claims.
/// Policy holders are CRM customers; opportunities are CRM deals — reuse, not duplication.
/// </summary>
[ApiController][Route("api/insurance")][Authorize]
public sealed class InsuranceController(CrmDbContext db) : ControllerBase
{
    [HttpGet("summary")]
    public async Task<IActionResult> Summary(CancellationToken ct)
    {
        var pol = await db.Policies.AsNoTracking().Select(x => new { x.Status, x.Premium, x.SumInsured }).ToListAsync(ct);
        var ren = await db.PolicyRenewals.AsNoTracking().CountAsync(x => x.Status == "due");
        var clm = await db.InsuranceClaims.AsNoTracking().Select(x => new { x.Status, x.ClaimAmount, x.ApprovedAmount }).ToListAsync(ct);
        return Ok(new
        {
            totalPolicies   = pol.Count,
            activePolicies  = pol.Count(x => x.Status is "issued" or "renewed"),
            proposals       = pol.Count(x => x.Status == "proposal"),
            premiumInForce  = pol.Where(x => x.Status is "issued" or "renewed").Sum(x => x.Premium),
            renewalsDue     = ren,
            openClaims      = clm.Count(x => x.Status is "filed" or "under_review"),
            claimsPaid      = clm.Where(x => x.Status == "paid").Sum(x => x.ApprovedAmount),
        });
    }

    // ── Policies ──────────────────────────────────────────────────────────────
    [HttpGet("policies")]
    public async Task<IActionResult> GetPolicies(CancellationToken ct) =>
        Ok((await db.Policies.AsNoTracking().OrderByDescending(x => x.CreatedAt).ToListAsync(ct)).Select(PolDto));

    [HttpPost("policies")]
    public async Task<IActionResult> CreatePolicy([FromBody] CreatePolicyReq r, CancellationToken ct)
    {
        var p = new Policy(r.LeadId, r.DealId, r.CustomerId, r.HolderName, r.ProductType, r.Premium, r.SumInsured, r.StartDate, r.EndDate, r.Agent, r.Notes);
        db.Policies.Add(p); await db.SaveChangesAsync(ct); return Ok(PolDto(p));
    }

    [HttpPatch("policies/{id:guid}/status")]
    public async Task<IActionResult> PolicyStatus(Guid id, [FromBody] StatusReq r, CancellationToken ct)
    { var p = await db.Policies.FindAsync([id], ct); if (p is null) return NotFound(); p.SetStatus(r.Status); await db.SaveChangesAsync(ct); return NoContent(); }

    /// <summary>Raise a renewal for a policy that's due.</summary>
    [HttpPost("policies/{id:guid}/renew")]
    public async Task<IActionResult> Renew(Guid id, [FromBody] RenewReq r, CancellationToken ct)
    {
        var p = await db.Policies.FindAsync([id], ct); if (p is null) return NotFound();
        var ren = new PolicyRenewal(p.Id, p.PolicyNumber, p.HolderName, r.RenewalDate, r.NewPremium ?? p.Premium, r.Notes);
        db.PolicyRenewals.Add(ren);
        await db.SaveChangesAsync(ct);
        return Ok(RenDto(ren));
    }

    [HttpDelete("policies/{id:guid}")]
    public async Task<IActionResult> DeletePolicy(Guid id, CancellationToken ct)
    { var p = await db.Policies.FindAsync([id], ct); if (p is null) return NotFound(); p.Delete(); await db.SaveChangesAsync(ct); return NoContent(); }

    // ── Renewals ──────────────────────────────────────────────────────────────
    [HttpGet("renewals")]
    public async Task<IActionResult> GetRenewals(CancellationToken ct) =>
        Ok((await db.PolicyRenewals.AsNoTracking().OrderByDescending(x => x.CreatedAt).ToListAsync(ct)).Select(RenDto));

    [HttpPost("renewals/{id:guid}/complete")]
    public async Task<IActionResult> CompleteRenewal(Guid id, CancellationToken ct)
    {
        var ren = await db.PolicyRenewals.FindAsync([id], ct); if (ren is null) return NotFound();
        ren.SetStatus("renewed");
        var pol = await db.Policies.FindAsync([ren.PolicyId], ct); pol?.SetStatus("renewed");
        await db.SaveChangesAsync(ct); return NoContent();
    }

    [HttpPatch("renewals/{id:guid}/status")]
    public async Task<IActionResult> RenewalStatus(Guid id, [FromBody] StatusReq r, CancellationToken ct)
    { var x = await db.PolicyRenewals.FindAsync([id], ct); if (x is null) return NotFound(); x.SetStatus(r.Status); await db.SaveChangesAsync(ct); return NoContent(); }

    [HttpDelete("renewals/{id:guid}")]
    public async Task<IActionResult> DeleteRenewal(Guid id, CancellationToken ct)
    { var x = await db.PolicyRenewals.FindAsync([id], ct); if (x is null) return NotFound(); x.Delete(); await db.SaveChangesAsync(ct); return NoContent(); }

    // ── Claims ────────────────────────────────────────────────────────────────
    [HttpGet("claims")]
    public async Task<IActionResult> GetClaims(CancellationToken ct) =>
        Ok((await db.InsuranceClaims.AsNoTracking().OrderByDescending(x => x.CreatedAt).ToListAsync(ct)).Select(ClmDto));

    [HttpPost("claims")]
    public async Task<IActionResult> CreateClaim([FromBody] CreateClaimReq r, CancellationToken ct)
    {
        var pol = await db.Policies.FindAsync([r.PolicyId], ct);
        if (pol is null) return NotFound(new { error = "Policy not found." });
        var c = new InsuranceClaim(pol.Id, pol.PolicyNumber, pol.CustomerId, pol.HolderName, r.ClaimDate, r.ClaimAmount, r.Reason, r.Notes);
        db.InsuranceClaims.Add(c); await db.SaveChangesAsync(ct); return Ok(ClmDto(c));
    }

    [HttpPost("claims/{id:guid}/approve")]
    public async Task<IActionResult> ApproveClaim(Guid id, [FromBody] ApproveReq r, CancellationToken ct)
    { var c = await db.InsuranceClaims.FindAsync([id], ct); if (c is null) return NotFound(); c.Approve(r.Amount); await db.SaveChangesAsync(ct); return Ok(ClmDto(c)); }

    [HttpPatch("claims/{id:guid}/status")]
    public async Task<IActionResult> ClaimStatus(Guid id, [FromBody] StatusReq r, CancellationToken ct)
    { var c = await db.InsuranceClaims.FindAsync([id], ct); if (c is null) return NotFound(); c.SetStatus(r.Status); await db.SaveChangesAsync(ct); return NoContent(); }

    [HttpDelete("claims/{id:guid}")]
    public async Task<IActionResult> DeleteClaim(Guid id, CancellationToken ct)
    { var c = await db.InsuranceClaims.FindAsync([id], ct); if (c is null) return NotFound(); c.Delete(); await db.SaveChangesAsync(ct); return NoContent(); }

    private static object PolDto(Policy p) => new { p.Id, p.PolicyNumber, p.LeadId, p.DealId, p.CustomerId, p.HolderName, p.ProductType, p.Premium, p.SumInsured, p.StartDate, p.EndDate, p.Status, p.Agent, p.Notes, p.CreatedAt };
    private static object RenDto(PolicyRenewal x) => new { x.Id, x.PolicyId, x.PolicyNumber, x.HolderName, x.RenewalDate, x.NewPremium, x.Status, x.Notes, x.CreatedAt };
    private static object ClmDto(InsuranceClaim c) => new { c.Id, c.ClaimNumber, c.PolicyId, c.PolicyNumber, c.CustomerId, c.HolderName, c.ClaimDate, c.ClaimAmount, c.ApprovedAmount, c.Status, c.Reason, c.Notes, c.CreatedAt };

    public record CreatePolicyReq(Guid? LeadId, Guid? DealId, Guid? CustomerId, string HolderName, string ProductType, decimal Premium, decimal SumInsured, string StartDate, string EndDate, string? Agent, string? Notes);
    public record RenewReq(string RenewalDate, decimal? NewPremium, string? Notes);
    public record CreateClaimReq(Guid PolicyId, string ClaimDate, decimal ClaimAmount, string? Reason, string? Notes);
    public record ApproveReq(decimal Amount);
    public record StatusReq(string Status);
}
