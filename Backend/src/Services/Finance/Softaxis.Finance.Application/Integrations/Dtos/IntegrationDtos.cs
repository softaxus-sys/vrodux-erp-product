namespace Softaxis.Finance.Application.Integrations.Dtos;

public sealed record IntegrationRoleDto(
    string Role, string Label, string Side, string DefaultAccountNumber,
    Guid? AccountId, string? AccountNumber, string? AccountName,
    bool IsMapped,      // the workspace chose this account (rather than inheriting the default)
    bool IsResolved,    // an account exists for the role
    bool IsActive);

public sealed record QueueCountsDto(int Pending, int Posted, int Failed, int Skipped, int Reversed);

public sealed record IntegrationDto(
    string Key, string Module, string Name, string Kind, string Trigger, string Notes,
    // connected | attention | partial | off | not_connected
    string Health,
    IReadOnlyList<string> Issues,
    // Queue-backed integrations only.
    string? Mode, string? StartDate, DateTime? LastSyncAt, string? LastSyncError,
    QueueCountsDto? Queue,
    // Documents in the owning module that should have reached the ledger, and how many are
    // tied to a journal entry (or, for a queue, have been collected).
    int? SourceDocuments, int? LinkedDocuments, string? SourceError,
    IReadOnlyList<IntegrationRoleDto> Roles,
    decimal? ApprovalLimit = null, bool RequireSeparateApprover = false, bool AutoAllowed = true);

public sealed record IntegrationOverviewDto(
    IReadOnlyList<IntegrationDto> Integrations,
    int Connected, int NeedAttention, int Partial, int NotConnected,
    int PendingItems, int FailedItems, string LedgerCurrency);

public sealed record PostingItemDto(
    Guid Id, string IntegrationKey, string IntegrationName, string SourceModule,
    Guid SourceId, string SourceNumber, string SourceDate, string Description,
    string CurrencyCode, decimal TotalAmount, string Status, int Attempts,
    string? LastError, DateTime? LastAttemptAt,
    Guid? JournalEntryId, string? JournalEntryNumber, DateTime? PostedAt, string? PostedByName,
    DateTime CreatedAt,
    DateTime? SubmittedAt = null, string? SubmittedByName = null);

public sealed record PostingItemPageDto(IReadOnlyList<PostingItemDto> Items, int TotalCount, int Page, int PageSize);

public sealed record PreviewLineDto(
    string Role, string RoleLabel, Guid? AccountId, string? AccountNumber, string? AccountName,
    decimal Debit, decimal Credit);

public sealed record PostingPreviewDto(
    PostingItemDto Item, IReadOnlyList<PreviewLineDto> Lines,
    decimal TotalDebit, decimal TotalCredit, decimal Rate, string LedgerCurrency,
    bool PeriodClosed, bool CanPost, IReadOnlyList<string> Problems,
    // What the document carried, in its own currency, before any rule was applied.
    IReadOnlyDictionary<string, decimal> SourceAmounts);

public sealed record PostResultItemDto(Guid ItemId, string Status, string? Error, string? JournalEntryNumber);

public sealed record PostResultDto(int Posted, int Failed, int Unchanged, IReadOnlyList<PostResultItemDto> Items);

public sealed record SyncResultItemDto(string IntegrationKey, int Collected, int Posted, int Failed, string? Error);

public sealed record SyncResultDto(int Collected, int Posted, int Failed, IReadOnlyList<SyncResultItemDto> Integrations);

// ── Check before posting ─────────────────────────────────────────────────────

public sealed record PostingCheckItemDto(
    Guid ItemId, string IntegrationKey, string SourceNumber, string SourceDate, string Status,
    decimal TotalDebit, decimal TotalCredit, bool CanPost, IReadOnlyList<string> Problems);

/// <summary>What the ready documents would add to one ledger account.</summary>
public sealed record PostingCheckAccountDto(string AccountNumber, string AccountName, decimal Debit, decimal Credit);

/// <summary>
/// The result of checking a selection before it is posted. Totals and the account summary cover
/// the ready documents only — they are what posting the selection would write to the ledger.
/// </summary>
public sealed record PostingCheckDto(
    int Items, int Ready, int Blocked,
    decimal TotalDebit, decimal TotalCredit, bool Balanced, string LedgerCurrency,
    IReadOnlyList<PostingCheckAccountDto> Accounts,
    IReadOnlyList<PostingCheckItemDto> Results);

/// <summary>What switching an integration to automatic posting would do, read before it is switched.</summary>
public sealed record AutoReadinessDto(
    string IntegrationKey, bool Ready, IReadOnlyList<string> Blockers,
    int PendingItems, decimal PendingAmount, int FailedItems,
    // Documents in the source module that the first automatic pass would collect and post.
    int? UncollectedDocuments,
    string DocumentCurrency, int IntervalMinutes);

/// <summary>
/// Who is asking, as far as approval levels go. Built from the signed-in user's token by the
/// controller; a handler that posts on someone's behalf is given one and enforces it.
/// </summary>
/// <param name="Modules">The workspace's licensed modules. Null = not restricted (super admin).</param>
public sealed record PostingCaller(Guid? UserId, bool CanApproveHigh, IReadOnlyList<string>? Modules);

public sealed record SubmitResultDto(int Changed, int Unchanged, IReadOnlyList<string> Problems);
