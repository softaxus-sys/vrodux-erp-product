using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.CRM.API.Controllers.Common;
using Softaxis.CRM.Application.Insurance.Commands;
using Softaxis.CRM.Application.Insurance.Queries;

namespace Softaxis.CRM.API.Controllers;

/// <summary>
/// Insurance pack: Policies → Renewals → Claims.
/// Policy holders are CRM customers; opportunities are CRM deals — reuse, not duplication.
/// </summary>
[ApiController][Route("api/insurance")][Authorize]
public sealed class InsuranceController(ISender sender) : CrmControllerBase
{
    [HttpGet("summary")]
    public async Task<IActionResult> Summary(CancellationToken ct)
    {
        var result = await sender.Send(new GetInsuranceSummaryQuery(), ct);
        return OkOrError(result);
    }

    // ── Policies ──────────────────────────────────────────────────────────────
    [HttpGet("policies")]
    public async Task<IActionResult> GetPolicies(CancellationToken ct)
    {
        var result = await sender.Send(new GetPoliciesQuery(), ct);
        return OkOrError(result);
    }

    [HttpPost("policies")]
    public async Task<IActionResult> CreatePolicy([FromBody] CreatePolicyCommand cmd, CancellationToken ct)
    {
        var result = await sender.Send(cmd, ct);
        return OkOrError(result);
    }

    [HttpPatch("policies/{id:guid}/status")]
    public async Task<IActionResult> PolicyStatus(Guid id, [FromBody] StatusReq r, CancellationToken ct)
    {
        var result = await sender.Send(new UpdatePolicyStatusCommand(id, r.Status), ct);
        return NoContentOrError(result);
    }

    /// <summary>Raise a renewal for a policy that's due.</summary>
    [HttpPost("policies/{id:guid}/renew")]
    public async Task<IActionResult> Renew(Guid id, [FromBody] RenewReq r, CancellationToken ct)
    {
        var result = await sender.Send(new RenewPolicyCommand(id, r.RenewalDate, r.NewPremium, r.Notes), ct);
        return OkOrError(result);
    }

    [HttpDelete("policies/{id:guid}")]
    public async Task<IActionResult> DeletePolicy(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new DeletePolicyCommand(id), ct);
        return NoContentOrError(result);
    }

    // ── Renewals ──────────────────────────────────────────────────────────────
    [HttpGet("renewals")]
    public async Task<IActionResult> GetRenewals(CancellationToken ct)
    {
        var result = await sender.Send(new GetRenewalsQuery(), ct);
        return OkOrError(result);
    }

    [HttpPost("renewals/{id:guid}/complete")]
    public async Task<IActionResult> CompleteRenewal(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new CompleteRenewalCommand(id), ct);
        return NoContentOrError(result);
    }

    [HttpPatch("renewals/{id:guid}/status")]
    public async Task<IActionResult> RenewalStatus(Guid id, [FromBody] StatusReq r, CancellationToken ct)
    {
        var result = await sender.Send(new UpdateRenewalStatusCommand(id, r.Status), ct);
        return NoContentOrError(result);
    }

    [HttpDelete("renewals/{id:guid}")]
    public async Task<IActionResult> DeleteRenewal(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new DeleteRenewalCommand(id), ct);
        return NoContentOrError(result);
    }

    // ── Claims ────────────────────────────────────────────────────────────────
    [HttpGet("claims")]
    public async Task<IActionResult> GetClaims(CancellationToken ct)
    {
        var result = await sender.Send(new GetClaimsQuery(), ct);
        return OkOrError(result);
    }

    [HttpPost("claims")]
    public async Task<IActionResult> CreateClaim([FromBody] CreateClaimCommand cmd, CancellationToken ct)
    {
        var result = await sender.Send(cmd, ct);
        return OkOrError(result);
    }

    [HttpPost("claims/{id:guid}/approve")]
    public async Task<IActionResult> ApproveClaim(Guid id, [FromBody] ApproveReq r, CancellationToken ct)
    {
        var result = await sender.Send(new ApproveClaimCommand(id, r.Amount), ct);
        return OkOrError(result);
    }

    [HttpPatch("claims/{id:guid}/status")]
    public async Task<IActionResult> ClaimStatus(Guid id, [FromBody] StatusReq r, CancellationToken ct)
    {
        var result = await sender.Send(new UpdateClaimStatusCommand(id, r.Status), ct);
        return NoContentOrError(result);
    }

    [HttpDelete("claims/{id:guid}")]
    public async Task<IActionResult> DeleteClaim(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new DeleteClaimCommand(id), ct);
        return NoContentOrError(result);
    }

    public sealed record RenewReq(string RenewalDate, decimal? NewPremium, string? Notes);
    public sealed record ApproveReq(decimal Amount);
    public sealed record StatusReq(string Status);
}
