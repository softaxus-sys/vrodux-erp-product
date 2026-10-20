namespace Softaxis.Finance.Domain.Entities;

/// <summary>
/// How one integration (e.g. "pos.sale") behaves for a workspace.
///
/// <para>No row means <c>off</c>. Nothing from another module reaches the ledger until a
/// workspace switches its integration on — a deploy must never start writing into a tenant's
/// books by itself.</para>
/// </summary>
public sealed class IntegrationSetting
{
    public const string Off    = "off";
    public const string Review = "review"; // documents are queued; a person posts them
    public const string Auto   = "auto";   // documents are queued and posted without review

    public static readonly string[] Modes = [Off, Review, Auto];

    private IntegrationSetting() { }

    public IntegrationSetting(string integrationKey)
    {
        Id             = Guid.NewGuid();
        IntegrationKey = integrationKey;
        Mode           = Off;
        CreatedAt      = DateTime.UtcNow;
    }

    public Guid      Id             { get; private set; }
    public string    IntegrationKey { get; private set; } = string.Empty;
    public string    Mode           { get; private set; } = Off;

    /// <summary>yyyy-MM-dd. Documents dated before this are never collected. Null = no lower bound.</summary>
    public string?   StartDate      { get; private set; }
    public DateTime? LastSyncAt     { get; private set; }
    public string?   LastSyncError  { get; private set; }
    public string?   UpdatedByName  { get; private set; }

    /// <summary>Documents above this amount (ledger currency) need the high-value approval
    /// permission to post, and are never posted automatically. Null = no limit.</summary>
    public decimal?  ApprovalLimit  { get; private set; }

    /// <summary>The person who submitted a document cannot be the one who approves it.</summary>
    public bool      RequireSeparateApprover { get; private set; }
    public DateTime  CreatedAt      { get; private set; }
    public DateTime? UpdatedAt      { get; private set; }

    public void Configure(string mode, string? startDate, string? updatedByName)
    {
        Mode          = mode;
        StartDate     = string.IsNullOrWhiteSpace(startDate) ? null : startDate.Trim();
        UpdatedByName = updatedByName?.Trim();
        UpdatedAt     = DateTime.UtcNow;
    }

    public void SetApprovalRules(decimal? limit, bool requireSeparateApprover, string? updatedByName)
    {
        ApprovalLimit           = limit is > 0 ? Math.Round(limit.Value, 2) : null;
        RequireSeparateApprover = requireSeparateApprover;
        UpdatedByName           = updatedByName?.Trim();
        UpdatedAt               = DateTime.UtcNow;
    }

    public void RecordSync(string? error)
    {
        LastSyncAt    = DateTime.UtcNow;
        LastSyncError = error is { Length: > 1000 } ? error[..1000] : error;
    }
}

/// <summary>
/// Which ledger account an integration's posting role (e.g. "revenue", "tax") lands in for a
/// workspace. No row = the integration's default account number is used.
/// </summary>
public sealed class AccountMapping
{
    private AccountMapping() { }

    public AccountMapping(string integrationKey, string role, Guid accountId)
    {
        Id             = Guid.NewGuid();
        IntegrationKey = integrationKey;
        Role           = role;
        AccountId      = accountId;
        CreatedAt      = DateTime.UtcNow;
    }

    public Guid      Id             { get; private set; }
    public string    IntegrationKey { get; private set; } = string.Empty;
    public string    Role           { get; private set; } = string.Empty;
    public Guid      AccountId      { get; private set; }
    public DateTime  CreatedAt      { get; private set; }
    public DateTime? UpdatedAt      { get; private set; }

    public void SetAccount(Guid accountId) { AccountId = accountId; UpdatedAt = DateTime.UtcNow; }
}

/// <summary>
/// One business document from another module, waiting to be (or already) posted to the ledger.
///
/// <para>The unique key (tenant, integration, source id) is the duplicate-posting guard: a
/// document can be collected any number of times and still only ever own one row, and so one
/// journal entry.</para>
/// </summary>
public sealed class PostingItem
{
    public const string Pending  = "pending";
    public const string Posting  = "posting";  // claimed by a worker; see Infrastructure PostingEngine
    public const string Posted   = "posted";
    public const string Failed   = "failed";
    public const string Skipped  = "skipped";
    public const string Reversed = "reversed";

    private PostingItem() { }

    public PostingItem(
        string integrationKey, string sourceModule, Guid sourceId, string sourceNumber,
        string sourceDate, string description, string currencyCode, string amountsJson, decimal totalAmount)
    {
        Id             = Guid.NewGuid();
        IntegrationKey = integrationKey;
        SourceModule   = sourceModule;
        SourceId       = sourceId;
        SourceNumber   = Cut(sourceNumber, 100);
        SourceDate     = sourceDate;
        Description    = Cut(description, 500);
        CurrencyCode   = currencyCode;
        AmountsJson    = amountsJson;
        TotalAmount    = totalAmount;
        Status         = Pending;
        CreatedAt      = DateTime.UtcNow;
    }

    public Guid      Id                 { get; private set; }
    public string    IntegrationKey     { get; private set; } = string.Empty;
    public string    SourceModule       { get; private set; } = string.Empty;
    public Guid      SourceId           { get; private set; }
    public string    SourceNumber       { get; private set; } = string.Empty;
    public string    SourceDate         { get; private set; } = string.Empty; // yyyy-MM-dd
    public string    Description        { get; private set; } = string.Empty;
    public string    CurrencyCode       { get; private set; } = string.Empty;

    /// <summary>Role → amount in the document's own currency, as last read from the source.
    /// Only ever replaced through <see cref="Refresh"/>, and never once posted.</summary>
    public string    AmountsJson        { get; private set; } = "{}";
    public decimal   TotalAmount        { get; private set; }
    public string    Status             { get; private set; } = Pending;
    public int       Attempts           { get; private set; }
    public string?   LastError          { get; private set; }
    public DateTime? LastAttemptAt      { get; private set; }
    public Guid?     JournalEntryId     { get; private set; }
    public string?   JournalEntryNumber { get; private set; }
    public DateTime? PostedAt           { get; private set; }
    public string?   PostedByName       { get; private set; }

    /// <summary>Set when someone puts the document forward for approval. Cleared if its figures change.</summary>
    public DateTime? SubmittedAt        { get; private set; }
    public Guid?     SubmittedByUserId  { get; private set; }
    public string?   SubmittedByName    { get; private set; }
    public DateTime  CreatedAt          { get; private set; }
    public DateTime? UpdatedAt          { get; private set; }

    public bool CanPost    => Status is Pending or Failed;
    public bool CanSkip    => Status is Pending or Failed;
    /// <summary>A skipped document, or one whose entry was reversed (to be posted again once its cause is fixed).</summary>
    public bool CanRequeue => Status is Skipped or Reversed;
    public bool CanReverse => Status is Posted;

    public void MarkPosted(Guid journalEntryId, string journalEntryNumber, string? postedByName)
    {
        Status             = Posted;
        Attempts          += 1;
        LastAttemptAt      = DateTime.UtcNow;
        LastError          = null;
        JournalEntryId     = journalEntryId;
        JournalEntryNumber = journalEntryNumber;
        PostedAt           = DateTime.UtcNow;
        PostedByName       = postedByName?.Trim();
        UpdatedAt          = DateTime.UtcNow;
    }

    public void MarkFailed(string error)
    {
        Status        = Failed;
        Attempts     += 1;
        LastAttemptAt = DateTime.UtcNow;
        LastError     = Cut(error, 1000);
        UpdatedAt     = DateTime.UtcNow;
    }

    /// <summary>
    /// Replaces the collected figures with what the source document says now. Only while the item
    /// is still open: what a posted item was posted with is history.
    /// </summary>
    public void Refresh(string sourceDate, string amountsJson, decimal totalAmount)
    {
        if (Status is not (Pending or Failed or Posting))
            throw new InvalidOperationException($"A {Status} item's figures cannot be changed.");
        ClearSubmission();   // the approver was shown other figures
        SourceDate  = sourceDate;
        AmountsJson = amountsJson;
        TotalAmount = totalAmount;
        UpdatedAt   = DateTime.UtcNow;
    }

    /// <summary>Holds an open item back with a reason, without counting it as a posting attempt.</summary>
    public void Hold(string reason)
    {
        if (Status is not (Pending or Failed)) return;
        ClearSubmission();
        Status    = Failed;
        LastError = Cut(reason, 1000);
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Puts a held item back in line once the reason it was held for has gone.</summary>
    public void ReleaseHold(string heldPrefix)
    {
        if (Status != Failed || LastError is null || !LastError.StartsWith(heldPrefix, StringComparison.Ordinal)) return;
        Status    = Pending;
        LastError = null;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Marks a posted item whose source document was cancelled afterwards. The entry stays in the
    /// ledger until a person reverses it; this is what tells them to.
    /// </summary>
    public void FlagCancelled(string note)
    {
        if (Status != Posted || LastError is not null) return;
        LastError = Cut(note, 1000);
        UpdatedAt = DateTime.UtcNow;
    }

    public void Submit(Guid? userId, string? name)
    {
        if (Status != Pending) throw new InvalidOperationException($"A {Status} item cannot be submitted.");
        SubmittedAt       = DateTime.UtcNow;
        SubmittedByUserId = userId;
        SubmittedByName   = name?.Trim();
        UpdatedAt         = DateTime.UtcNow;
    }

    public void WithdrawSubmission()
    {
        ClearSubmission();
        UpdatedAt = DateTime.UtcNow;
    }

    private void ClearSubmission() { SubmittedAt = null; SubmittedByUserId = null; SubmittedByName = null; }

    public void Skip(string? reason)
    {
        if (!CanSkip) throw new InvalidOperationException($"A {Status} item cannot be skipped.");
        Status    = Skipped;
        LastError = string.IsNullOrWhiteSpace(reason) ? null : Cut(reason, 1000);
        UpdatedAt = DateTime.UtcNow;
    }

    public void Requeue()
    {
        if (!CanRequeue) throw new InvalidOperationException($"A {Status} item cannot be put back in the queue.");
        Status    = Pending;
        LastError = null;
        ClearSubmission();
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkReversed(string? reason = null)
    {
        if (!CanReverse) throw new InvalidOperationException($"A {Status} item has no journal entry to reverse.");
        Status    = Reversed;
        ClearSubmission();
        LastError = string.IsNullOrWhiteSpace(reason) ? null : Cut(reason, 1000);
        UpdatedAt = DateTime.UtcNow;
    }

    private static string Cut(string value, int max)
    {
        var v = (value ?? string.Empty).Trim();
        return v.Length > max ? v[..max] : v;
    }
}
