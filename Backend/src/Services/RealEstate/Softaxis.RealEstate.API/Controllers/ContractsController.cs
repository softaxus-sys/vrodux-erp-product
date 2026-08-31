using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.RealEstate.API.Authorization;
using Softaxis.RealEstate.API.Controllers.Common;
using Softaxis.RealEstate.Application.Contracts.Commands;
using Softaxis.RealEstate.Application.Contracts.Queries;

namespace Softaxis.RealEstate.API.Controllers;

[ApiController][Route("api/real-estate/contracts")][Authorize]
public sealed class ContractsController(ISender sender) : RealEstateControllerBase
{
    // Inline REQUEST records only (route + body shapes). Response DTOs live in Application/Dtos,
    // per the mandatory CQRS layout — same exception Finance's AccountsController uses.
    public sealed record CreateContractRequest(
        Guid PropertyId, Guid UnitId, Guid TenantId, string StartDate, string EndDate,
        decimal AnnualRent, decimal SecurityDeposit, string PaymentFrequency,
        string? EjariNumber, string? Notes,
        decimal AdvanceRentAmount = 0, string? AdvancePaidDate = null,
        string? AdvanceMethod = null, string? AdvanceReference = null);

    public sealed record UpdateContractRequest(
        string StartDate, string EndDate, decimal AnnualRent, decimal SecurityDeposit,
        string PaymentFrequency, string? EjariNumber, string? Notes, bool RegenerateSchedule = false);

    public sealed record StatusRequest(string Status);
    public sealed record GenerateScheduleRequest(bool ReplaceExisting = false);
    public sealed record RecordPaymentRequest(decimal Amount, string PaidDate, string? Method, string? Reference, string? Notes);
    public sealed record WaiveRequest(string? Reason);

    // ── Reads ────────────────────────────────────────────────────────────────

    [HttpGet("summary")]
    [RequirePermission("real-estate.contracts.view")]
    public async Task<IActionResult> GetSummary(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetContractsSummaryQuery(), ct));

    [HttpGet]
    [RequirePermission("real-estate.contracts.view")]
    public async Task<IActionResult> GetAll([FromQuery] Guid? tenantId, [FromQuery] string? status, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetContractsQuery(tenantId, status), ct));

    [HttpGet("{id:guid}")]
    [RequirePermission("real-estate.contracts.view")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetContractByIdQuery(id), ct));

    /// <summary>The chase queue — everything overdue, plus what falls due inside the window.</summary>
    [HttpGet("rent-due")]
    [RequirePermission("real-estate.rent.view")]
    public async Task<IActionResult> GetRentDue(
        [FromQuery] int withinDays = 30, [FromQuery] bool includeOverdue = true, CancellationToken ct = default) =>
        OkOrError(await sender.Send(new GetRentDueQuery(withinDays, includeOverdue), ct));

    // ── Writes ───────────────────────────────────────────────────────────────

    [HttpPost]
    [RequirePermission("real-estate.contracts.create")]
    public async Task<IActionResult> Create([FromBody] CreateContractRequest req, CancellationToken ct)
    {
        var result = await sender.Send(new CreateContractCommand(
            req.PropertyId, req.UnitId, req.TenantId, req.StartDate, req.EndDate,
            req.AnnualRent, req.SecurityDeposit, req.PaymentFrequency, req.EjariNumber, req.Notes,
            req.AdvanceRentAmount, req.AdvancePaidDate, req.AdvanceMethod, req.AdvanceReference), ct);

        return result.IsSuccess
            ? CreatedOrError(result, nameof(GetById), new { id = result.Value.Id })
            : OkOrError(result);
    }

    [HttpPut("{id:guid}")]
    [RequirePermission("real-estate.contracts.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateContractRequest req, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new UpdateContractCommand(
            id, req.StartDate, req.EndDate, req.AnnualRent, req.SecurityDeposit,
            req.PaymentFrequency, req.EjariNumber, req.Notes, req.RegenerateSchedule), ct));

    [HttpPatch("{id:guid}/status")]
    [RequirePermission("real-estate.contracts.edit")]
    public async Task<IActionResult> SetStatus(Guid id, [FromBody] StatusRequest req, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new SetContractStatusCommand(id, req.Status), ct));

    [HttpDelete("{id:guid}")]
    [RequirePermission("real-estate.contracts.delete")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteContractCommand(id), ct));

    // ── Rent schedule ────────────────────────────────────────────────────────

    [HttpPost("{id:guid}/schedule")]
    [RequirePermission("real-estate.contracts.edit")]
    public async Task<IActionResult> GenerateSchedule(Guid id, [FromBody] GenerateScheduleRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new GenerateRentScheduleCommand(id, req.ReplaceExisting), ct));

    // Recording money received is gated separately from editing the lease: the person who takes a
    // cheque at the counter is rarely the person allowed to change the rent.
    [HttpPost("{id:guid}/installments/{installmentId:guid}/payment")]
    [RequirePermission("real-estate.rent.record")]
    public async Task<IActionResult> RecordPayment(
        Guid id, Guid installmentId, [FromBody] RecordPaymentRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new RecordInstallmentPaymentCommand(
            id, installmentId, req.Amount, req.PaidDate, req.Method, req.Reference, req.Notes), ct));

    [HttpPost("{id:guid}/installments/{installmentId:guid}/waive")]
    [RequirePermission("real-estate.rent.record")]
    public async Task<IActionResult> Waive(
        Guid id, Guid installmentId, [FromBody] WaiveRequest req, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new WaiveInstallmentCommand(id, installmentId, req.Reason), ct));

    /// <summary>Send this lease's notice now, outside the nightly sweep. Omit the installment id
    /// to send the expiry notice instead.</summary>
    [HttpPost("{id:guid}/remind")]
    [RequirePermission("real-estate.rent.remind")]
    public async Task<IActionResult> Remind(Guid id, [FromQuery] Guid? installmentId, CancellationToken ct) =>
        OkOrError(await sender.Send(new SendRentReminderCommand(id, installmentId), ct));
}
