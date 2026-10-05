namespace Softaxis.Finance.Application.RecurringExpenses.Dtos;

public sealed record RecurringExpenseDto(
    Guid Id, string TemplateName, string Category, decimal Amount, string? Vendor,
    string PaymentMethod, string Frequency, string StartDate, string? EndDate, string NextRunDate,
    bool AutoPost, string? Reference, string? Notes, bool IsActive,
    string? LastGeneratedDate, int GeneratedCount,
    Guid? ExpenseAccountId = null, Guid? PaymentAccountId = null);

/// <summary>
/// What generating from one template did. <c>Status</c> is the expense's resulting status, so the
/// caller can tell "posted to the ledger" from "created, waiting for approval". <c>Message</c> is
/// set when an auto-post template could not post and the expense was left pending instead.
/// </summary>
public sealed record GenerateRecurringExpenseResultDto(
    Guid ExpenseId, string ExpenseNumber, string Status, string? Message = null);

/// <summary><c>HeldForReview</c> counts auto-post expenses that could not be posted (closed fiscal
/// period) and were left pending.</summary>
public sealed record RunDueRecurringExpensesResultDto(int Generated, int Posted, int HeldForReview);
