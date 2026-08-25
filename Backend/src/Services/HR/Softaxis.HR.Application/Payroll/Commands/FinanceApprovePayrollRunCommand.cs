using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.HR.Application.Payroll.Commands;

/// <summary>
/// Finance signs off a processed payroll run, which is what allows it to be paid.
///
/// <para>HR can prepare and process a run but cannot pay it: <c>PayPayrollRunHandler</c> requires
/// <c>finance_approved</c>. That separation is the point of the step — the people who decide what
/// staff are owed are not the people who release the money.</para>
/// </summary>
/// <param name="ApprovedByName">
/// Display name of the approver, taken from the caller's token by the controller rather than the
/// request body — an approval that can name someone else is not an audit trail.
/// </param>
public sealed record FinanceApprovePayrollRunCommand(
    Guid    Id,
    string? ApprovedByName) : ICommand;

/// <summary>
/// Records the accounting entry that Finance approval produced, so the run points at the journal
/// entry and the ledger is reachable from the payroll screen.
/// </summary>
public sealed record LinkPayrollJournalEntryCommand(
    Guid    Id,
    Guid    JournalEntryId,
    string? JournalEntryNumber) : ICommand;
