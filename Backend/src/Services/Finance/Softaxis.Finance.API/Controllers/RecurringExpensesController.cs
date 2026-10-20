using System.Security.Claims;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Finance.API.Authorization;
using Softaxis.Finance.API.Controllers.Common;
using Softaxis.Finance.Application.RecurringExpenses.Commands;
using Softaxis.Finance.Application.RecurringExpenses.Queries;

namespace Softaxis.Finance.API.Controllers;

[ApiController]
[Route("api/finance/recurring-expenses")]
[Authorize]
public sealed class RecurringExpensesController(ISender sender) : FinanceControllerBase
{
    private const string ApprovePermission = "finance.expenses.approve";

    [HttpGet]
    [RequirePermission("finance.expenses.view")]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var result = await sender.Send(new GetRecurringExpensesQuery(), ct);
        return OkOrError(result);
    }

    [HttpGet("{id:guid}")]
    [RequirePermission("finance.expenses.view")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new GetRecurringExpenseByIdQuery(id), ct);
        return OkOrError(result);
    }

    public sealed record CreateRequest(
        string TemplateName, string Category, decimal Amount, string? Vendor,
        string? PaymentMethod, string Frequency, string StartDate, string? EndDate,
        bool AutoPost = false, string? Reference = null, string? Notes = null,
        Guid? ExpenseAccountId = null, Guid? PaymentAccountId = null);

    public sealed record UpdateRequest(
        string TemplateName, string Category, decimal Amount, string? Vendor,
        string? PaymentMethod, string Frequency, string? NextRunDate, string? EndDate,
        bool AutoPost = false, string? Reference = null, string? Notes = null,
        Guid? ExpenseAccountId = null, Guid? PaymentAccountId = null);

    [HttpPost]
    [RequirePermission("finance.expenses.create")]
    public async Task<IActionResult> Create([FromBody] CreateRequest req, CancellationToken ct)
    {
        if (req.AutoPost && AutoPostDenied() is { } denied) return denied;

        var result = await sender.Send(new CreateRecurringExpenseCommand(
            req.TemplateName, req.Category, req.Amount, req.Vendor, req.PaymentMethod, req.Frequency,
            req.StartDate, req.EndDate, req.AutoPost, req.Reference, req.Notes,
            req.ExpenseAccountId, req.PaymentAccountId), ct);

        return CreatedOrError(result, nameof(GetById), result.IsSuccess ? new { id = result.Value.Id } : null!);
    }

    [HttpPut("{id:guid}")]
    [RequirePermission("finance.expenses.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateRequest req, CancellationToken ct)
    {
        if (req.AutoPost && AutoPostDenied() is { } denied) return denied;

        var result = await sender.Send(new UpdateRecurringExpenseCommand(
            id, req.TemplateName, req.Category, req.Amount, req.Vendor, req.PaymentMethod, req.Frequency,
            req.NextRunDate, req.EndDate, req.AutoPost, req.Reference, req.Notes,
            req.ExpenseAccountId, req.PaymentAccountId), ct);

        return NoContentOrError(result);
    }

    [HttpPost("{id:guid}/pause")]
    [RequirePermission("finance.expenses.edit")]
    public async Task<IActionResult> Pause(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new PauseRecurringExpenseCommand(id), ct);
        return NoContentOrError(result);
    }

    [HttpPost("{id:guid}/resume")]
    [RequirePermission("finance.expenses.edit")]
    public async Task<IActionResult> Resume(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new ResumeRecurringExpenseCommand(id), ct);
        return NoContentOrError(result);
    }

    [HttpDelete("{id:guid}")]
    [RequirePermission("finance.expenses.delete")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new DeleteRecurringExpenseCommand(id), ct);
        return NoContentOrError(result);
    }

    /// <summary>Generate one expense now from this template (takes the place of its next run).</summary>
    [HttpPost("{id:guid}/generate")]
    [RequirePermission("finance.expenses.create")]
    public async Task<IActionResult> GenerateNow(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new GenerateRecurringExpenseNowCommand(id), ct);
        return OkOrError(result);
    }

    /// <summary>Generate expenses for every template that is currently due.</summary>
    [HttpPost("run-due")]
    [RequirePermission("finance.expenses.create")]
    public async Task<IActionResult> RunDue(CancellationToken ct)
    {
        var result = await sender.Send(new RunDueRecurringExpensesCommand(), ct);
        return OkOrError(result);
    }

    /// <summary>
    /// Switching auto-post on is approving every future expense from the template in advance, so
    /// it needs the approval permission — otherwise anyone who can create an expense could approve
    /// and pay their own by wrapping it in a template.
    /// </summary>
    private IActionResult? AutoPostDenied()
    {
        if (User.FindFirstValue("is_super_admin") == "true") return null;
        if (User.HasClaim("permission", ApprovePermission)) return null;

        return StatusCode(StatusCodes.Status403Forbidden, new
        {
            Code = "Permission.Denied",
            Description = "Turning on auto-post needs the expense approval permission, because the expenses it generates skip approval.",
        });
    }
}
