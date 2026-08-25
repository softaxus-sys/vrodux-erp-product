using System.Security.Claims;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.HR.API.Authorization;
using Softaxis.HR.API.Controllers.Common;
using Softaxis.HR.Application.Payroll.Commands;
using Softaxis.HR.Application.Payroll.Dtos;
using Softaxis.HR.Application.Payroll.Queries;

namespace Softaxis.HR.API.Controllers;

[ApiController]
[Route("api/hr/payroll")]
[Authorize]
public sealed class PayrollController(ISender sender) : HrControllerBase
{
    public sealed record SlipRequest(
        Guid    EmployeeId,
        string  EmployeeName,
        string? JobTitle,
        string? DepartmentName,
        decimal BasicSalary,
        decimal Allowances,
        decimal Deductions,
        string? Notes);

    public sealed record CreatePayrollRunRequest(
        string  Period,
        string? Notes,
        IReadOnlyList<SlipRequest> Slips);

    public sealed record GenerateRequest(string Period, string? Notes);

    public sealed record RejectRequest(string? Reason);

    public sealed record UpdateSlipRequest(decimal Allowances, decimal Deductions, string? Notes);

    /// <summary>
    /// The Finance sign-off key. It lives in the Finance module because it is a Finance
    /// responsibility: the approver needs no HR permissions at all, and giving them
    /// <c>hr.payroll.approve</c> would also let them process and pay — which is exactly the
    /// separation this step exists to create.
    /// </summary>
    private const string FinanceApprove = "finance.payroll.approve";

    private string? CurrentUserId => User.FindFirstValue(ClaimTypes.NameIdentifier);

    private string? CurrentUserName =>
        User.FindFirstValue(ClaimTypes.Name)
        ?? User.FindFirstValue("name")
        ?? User.FindFirstValue(ClaimTypes.Email);

    // ── GET /api/hr/payroll/summary ──────────────────────────────────────
    [HttpGet("summary")]
    [RequireAnyPermission("hr.payroll.view", FinanceApprove)]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var result = await sender.Send(new GetPayrollSummaryQuery(), ct);
        return OkOrError(result);
    }

    // ── GET /api/hr/payroll ──────────────────────────────────────────────
    [HttpGet]
    [RequireAnyPermission("hr.payroll.view", FinanceApprove)]
    public async Task<IActionResult> GetAll(
        [FromQuery] int     page     = 1,
        [FromQuery] int     pageSize = 20,
        [FromQuery] string? period   = null,
        [FromQuery] string? status   = null,
        CancellationToken ct = default)
    {
        var result = await sender.Send(new GetPayrollRunsQuery(page, pageSize, period, status), ct);
        return OkOrError(result);
    }

    // ── GET /api/hr/payroll/employees/{employeeId}/slips ─────────────────
    [HttpGet("employees/{employeeId:guid}/slips")]
    [RequireAnyPermission("hr.payroll.view", FinanceApprove)]
    public async Task<IActionResult> GetEmployeePayslips(Guid employeeId, CancellationToken ct)
    {
        var result = await sender.Send(new GetEmployeePayslipsQuery(employeeId), ct);
        return OkOrError(result);
    }


    // ── GET /api/hr/payroll/{id} ─────────────────────────────────────────
    [HttpGet("{id:guid}")]
    [RequireAnyPermission("hr.payroll.view", FinanceApprove)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new GetPayrollRunByIdQuery(id), ct);
        return OkOrError(result);
    }

    // ── POST /api/hr/payroll ─────────────────────────────────────────────
    [HttpPost]
    [RequirePermission("hr.payroll.create")]
    public async Task<IActionResult> Create([FromBody] CreatePayrollRunRequest req, CancellationToken ct)
    {
        var slips = req.Slips
            .Select(s => new PayrollSlipInputDto(
                s.EmployeeId, s.EmployeeName, s.JobTitle, s.DepartmentName,
                s.BasicSalary, s.Allowances, s.Deductions, s.Notes))
            .ToList();

        var result = await sender.Send(
            new CreatePayrollRunCommand(req.Period, req.Notes, slips, CurrentUserId, CurrentUserName), ct);
        return CreatedOrError(result, nameof(GetById), new { id = result.IsSuccess ? (object?)result.Value.Id : null });
    }

    // ── POST /api/hr/payroll/generate ────────────────────────────────────
    [HttpPost("generate")]
    [RequirePermission("hr.payroll.create")]
    public async Task<IActionResult> Generate([FromBody] GenerateRequest req, CancellationToken ct)
    {
        var result = await sender.Send(
            new GeneratePayrollRunCommand(req.Period, req.Notes, CurrentUserId, CurrentUserName), ct);
        return CreatedOrError(result, nameof(GetById), new { id = result.IsSuccess ? (object?)result.Value.Id : null });
    }

    // ── POST /api/hr/payroll/{id}/reject ─────────────────────────────────
    [HttpPost("{id:guid}/reject")]
    // HR rejecting its own draft, or Finance sending a processed run back.
    [RequireAnyPermission("hr.payroll.approve", FinanceApprove)]
    public async Task<IActionResult> Reject(Guid id, [FromBody] RejectRequest req, CancellationToken ct)
    {
        var result = await sender.Send(new RejectPayrollRunCommand(id, req.Reason, CurrentUserName), ct);
        return NoContentOrError(result);
    }

    // ── GET /api/hr/payroll/{runId}/slips/{slipId} ───────────────────────
    [HttpGet("{runId:guid}/slips/{slipId:guid}")]
    [RequireAnyPermission("hr.payroll.view", FinanceApprove)]
    public async Task<IActionResult> GetSlip(Guid runId, Guid slipId, CancellationToken ct)
    {
        var result = await sender.Send(new GetPayrollSlipQuery(runId, slipId), ct);
        return OkOrError(result);
    }

    // ── POST /api/hr/payroll/{runId}/slips/{slipId}/send-email ───────────
    [HttpPost("{runId:guid}/slips/{slipId:guid}/send-email")]
    [RequirePermission("hr.payroll.print")]
    public async Task<IActionResult> SendSlipEmail(Guid runId, Guid slipId, CancellationToken ct)
    {
        var result = await sender.Send(new SendPayrollSlipEmailCommand(runId, slipId), ct);
        return OkOrError(result);
    }

    // ── POST /api/hr/payroll/{id}/process ────────────────────────────────
    [HttpPost("{id:guid}/process")]
    [RequirePermission("hr.payroll.approve")]
    public async Task<IActionResult> Process(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new ProcessPayrollRunCommand(id), ct);
        return NoContentOrError(result);
    }

    // ── POST /api/hr/payroll/{id}/pay ────────────────────────────────────
    [HttpPost("{id:guid}/pay")]
    [RequirePermission("hr.payroll.approve")]
    public async Task<IActionResult> Pay(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new PayPayrollRunCommand(id), ct);
        return NoContentOrError(result);
    }

    // ── POST /api/hr/payroll/{id}/reopen ─────────────────────────────────
    [HttpPost("{id:guid}/reopen")]
    [RequirePermission("hr.payroll.approve")]
    public async Task<IActionResult> Reopen(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new ReopenPayrollRunCommand(id), ct);
        return NoContentOrError(result);
    }

    // NOTE: payroll has no seeded "edit"/"delete" — slip edits & run delete are privileged, gate on "approve".
    // ── PUT /api/hr/payroll/{runId}/slips/{slipId} ───────────────────────
    [HttpPut("{runId:guid}/slips/{slipId:guid}")]
    // Finance corrects figures during review, so this is open to the approver as well as HR.
    [RequireAnyPermission("hr.payroll.approve", FinanceApprove)]
    public async Task<IActionResult> UpdateSlip(Guid runId, Guid slipId, [FromBody] UpdateSlipRequest req, CancellationToken ct)
    {
        var result = await sender.Send(
            new UpdatePayrollSlipCommand(runId, slipId, req.Allowances, req.Deductions, req.Notes), ct);
        return NoContentOrError(result);
    }

    // ── DELETE /api/hr/payroll/{id} ──────────────────────────────────────
    [HttpDelete("{id:guid}")]
    [RequirePermission("hr.payroll.approve")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new DeletePayrollRunCommand(id), ct);
        return NoContentOrError(result);
    }

    // ── POST /api/hr/payroll/{id}/finance-approve ────────────────────────
    [HttpPost("{id:guid}/finance-approve")]
    [RequirePermission(FinanceApprove)]
    public async Task<IActionResult> FinanceApproveRun(Guid id, CancellationToken ct)
    {
        // The approver's name comes from the token, never the body: an approval that can name
        // somebody else is not an audit trail.
        var result = await sender.Send(new FinanceApprovePayrollRunCommand(id, CurrentUserName), ct);
        return NoContentOrError(result);
    }

    // ── PATCH /api/hr/payroll/{id}/journal-entry ─────────────────────────
    [HttpPatch("{id:guid}/journal-entry")]
    [RequirePermission(FinanceApprove)]
    public async Task<IActionResult> LinkJournalEntry(
        Guid id, [FromBody] LinkJournalEntryRequest req, CancellationToken ct)
    {
        var result = await sender.Send(
            new LinkPayrollJournalEntryCommand(id, req.JournalEntryId, req.JournalEntryNumber), ct);
        return NoContentOrError(result);
    }
    // ── GET /api/hr/payroll/wps/config ───────────────────────────────────
    [HttpGet("wps/config")]
    [RequireAnyPermission("hr.payroll.view", FinanceApprove)]
    public async Task<IActionResult> GetWpsConfig(CancellationToken ct)
        => OkOrError(await sender.Send(new GetWpsConfigurationQuery(), ct));

    // ── PUT /api/hr/payroll/wps/config ───────────────────────────────────
    [HttpPut("wps/config")]
    [RequirePermission("hr.payroll.approve")]
    public async Task<IActionResult> UpdateWpsConfig(
        [FromBody] UpdateWpsConfigurationCommand command, CancellationToken ct)
        => OkOrError(await sender.Send(command, ct));

    // ── GET /api/hr/payroll/{id}/wps-sif ─────────────────────────────────
    // Returns the file as data rather than a download, so the caller can show which employees
    // were left out before anything is sent to the bank.
    [HttpGet("{id:guid}/wps-sif")]
    [RequirePermission("hr.payroll.print")]
    public async Task<IActionResult> GetWpsSif(Guid id, CancellationToken ct)
        => OkOrError(await sender.Send(new GetWpsSifQuery(id), ct));
}


public sealed record LinkJournalEntryRequest(Guid JournalEntryId, string? JournalEntryNumber);
