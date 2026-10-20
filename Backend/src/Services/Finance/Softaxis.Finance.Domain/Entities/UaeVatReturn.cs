namespace Softaxis.Finance.Domain.Entities;

/// <summary>
/// The workspace's UAE VAT registration — the identity printed on the FTA Audit File (FAF) and the
/// VAT 201 return. One row per workspace (tenant-isolated by the Finance namespace filter).
///
/// <para>Kept separate from General Settings' free-text <c>taxNumber</c> on purpose: that field is
/// a letterhead label, while this is a legal registration that gates filing and is validated as a
/// 15-digit TRN.</para>
/// </summary>
public sealed class UaeVatProfile
{
    private UaeVatProfile() { }

    public UaeVatProfile(string trn, string nameEn)
    {
        Id = Guid.NewGuid();
        CreatedAt = DateTime.UtcNow;
        Update(trn, nameEn, null, null, "DXB", null, null, null, null);
    }

    public Guid      Id              { get; private set; }
    public string    Trn             { get; private set; } = string.Empty;
    public string    NameEn          { get; private set; } = string.Empty;
    public string?   NameAr          { get; private set; }
    public string?   Address         { get; private set; }
    /// <summary>
    /// Emirate code (AUH/DXB/SHJ/AJM/UAQ/RAK/FUJ) where supplies are treated as made. Invoices
    /// carry no place-of-supply field yet, so every standard-rated supply is reported in this
    /// emirate's box (1a–1g) — surfaced as a warning on every return.
    /// </summary>
    public string    DefaultEmirate  { get; private set; } = "DXB";
    public string?   TaxAgencyName   { get; private set; }
    public string?   Tan             { get; private set; }
    public string?   TaxAgentName    { get; private set; }
    public string?   Taan            { get; private set; }
    public DateTime  CreatedAt       { get; private set; }
    public DateTime? UpdatedAt       { get; private set; }

    public void Update(string trn, string nameEn, string? nameAr, string? address, string defaultEmirate,
        string? taxAgencyName, string? tan, string? taxAgentName, string? taan)
    {
        Trn            = new string((trn ?? "").Where(char.IsDigit).ToArray());
        NameEn         = (nameEn ?? "").Trim();
        NameAr         = Clean(nameAr);
        Address        = Clean(address);
        DefaultEmirate = (defaultEmirate ?? "DXB").Trim().ToUpperInvariant();
        TaxAgencyName  = Clean(taxAgencyName);
        Tan            = Clean(tan);
        TaxAgentName   = Clean(taxAgentName);
        Taan           = Clean(taan);
        UpdatedAt      = DateTime.UtcNow;
    }

    private static string? Clean(string? v) => string.IsNullOrWhiteSpace(v) ? null : v.Trim();
}

/// <summary>Statuses of a <see cref="VatReturn"/>. Strings, matching the rest of Finance.</summary>
public static class VatReturnStatus
{
    public const string Draft          = "draft";
    public const string Validated      = "validated";
    public const string Reconciled     = "reconciled";
    public const string Approved       = "approved";
    public const string ReadyToSubmit  = "ready_to_submit";
    public const string Submitted      = "submitted";
    public const string Acknowledged   = "acknowledged";
    public const string Rejected       = "rejected";
    /// <summary>The return file was uploaded to EmaraTax by a person (FTA spec "Option 1").</summary>
    public const string FiledViaPortal = "filed_via_portal";

    /// <summary>States from which figures may be re-prepared from the ledger.</summary>
    public static readonly string[] Editable = [Draft, Validated, Reconciled, Rejected];

    /// <summary>States that mean the return has left Vrodux; nothing may be regenerated after these.</summary>
    public static readonly string[] Final = [Submitted, Acknowledged, FiledViaPortal];
}

/// <summary>
/// One VAT 201 return for one <see cref="TaxPeriod"/>: a frozen snapshot of the figures, the files
/// generated from them, and the submission trail.
///
/// <para><b>Approval ≠ transmission ≠ acceptance.</b> <see cref="Approve"/> is an internal sign-off.
/// <see cref="Status"/> only becomes <c>submitted</c>/<c>acknowledged</c>/<c>rejected</c> from an
/// actual gateway response recorded through <see cref="CompleteAttempt"/> — never from a button.</para>
///
/// <para><b>Idempotency.</b> <see cref="IdempotencyKey"/> is fixed when the return is frozen
/// (<see cref="MarkReady"/>) and sent with every attempt, so a retry after a timeout can be
/// de-duplicated by the receiver. Locally, <see cref="BeginAttempt"/> refuses a new attempt while one
/// is in flight or once the return was accepted, so a double click cannot send it twice.</para>
/// </summary>
public sealed class VatReturn
{
    private VatReturn() { }

    public VatReturn(Guid taxPeriodId, string periodLabel, string fromDate, string toDate)
    {
        Id          = Guid.NewGuid();
        TaxPeriodId = taxPeriodId;
        PeriodLabel = periodLabel;
        FromDate    = fromDate;
        ToDate      = toDate;
        Status      = VatReturnStatus.Draft;
        CreatedAt   = DateTime.UtcNow;
    }

    public Guid      Id                  { get; private set; }
    public Guid      TaxPeriodId         { get; private set; }
    public string    PeriodLabel         { get; private set; } = string.Empty;
    public string    FromDate            { get; private set; } = string.Empty;
    public string    ToDate              { get; private set; } = string.Empty;
    public string    Status              { get; private set; } = VatReturnStatus.Draft;

    public string    Trn                 { get; private set; } = string.Empty;
    public decimal   OutputVat           { get; private set; }
    public decimal   InputVat            { get; private set; }
    public decimal   NetVat              { get; private set; }
    public string    BoxesJson           { get; private set; } = "{}";
    public string    IssuesJson          { get; private set; } = "[]";
    public string    ReconciliationJson  { get; private set; } = "{}";
    public bool      HasBlockingErrors   { get; private set; }
    public bool      IsReconciled        { get; private set; }

    public string?   FafContent          { get; private set; }
    public string?   ReturnXml           { get; private set; }
    public string?   ContentHash         { get; private set; }
    public string?   IdempotencyKey      { get; private set; }

    public string?   PreparedByName      { get; private set; }
    public DateTime? PreparedAt          { get; private set; }
    public string?   ApprovedByUserId    { get; private set; }
    public string?   ApprovedByName      { get; private set; }
    public DateTime? ApprovedAt          { get; private set; }

    public string?   Environment         { get; private set; }
    public string?   SubmissionReference { get; private set; }
    public DateTime? SubmittedAt         { get; private set; }
    public DateTime? AcknowledgedAt      { get; private set; }
    public string?   RejectionReason     { get; private set; }
    public string?   FiledByName         { get; private set; }

    public DateTime  CreatedAt           { get; private set; }
    public DateTime? UpdatedAt           { get; private set; }
    public bool      IsDeleted           { get; private set; }

    public ICollection<VatReturnAttempt> Attempts { get; private set; } = new List<VatReturnAttempt>();

    public bool CanReprepare => VatReturnStatus.Editable.Contains(Status);

    /// <summary>Stores freshly computed figures. Status follows the facts: errors → draft, clean → validated, matching the GL → reconciled.</summary>
    public void ApplyPreparation(string trn, decimal output, decimal input, decimal net,
        string boxesJson, string issuesJson, string reconciliationJson,
        bool hasBlockingErrors, bool isReconciled, string preparedBy)
    {
        if (!CanReprepare)
            throw new InvalidOperationException($"A {Status} return cannot be re-prepared.");

        Trn = trn; OutputVat = output; InputVat = input; NetVat = net;
        BoxesJson = boxesJson; IssuesJson = issuesJson; ReconciliationJson = reconciliationJson;
        HasBlockingErrors = hasBlockingErrors; IsReconciled = isReconciled;
        PreparedByName = preparedBy; PreparedAt = DateTime.UtcNow;
        ApprovedAt = null; ApprovedByName = null; ApprovedByUserId = null;
        FafContent = null; ReturnXml = null; ContentHash = null; IdempotencyKey = null;
        RejectionReason = null;
        Status = hasBlockingErrors ? VatReturnStatus.Draft
               : isReconciled      ? VatReturnStatus.Reconciled
               :                     VatReturnStatus.Validated;
        Touch();
    }

    /// <summary>Internal sign-off. Requires a validated, reconciled return.</summary>
    public string? Approve(string? userId, string? userName)
    {
        if (Status != VatReturnStatus.Reconciled)
            return Status == VatReturnStatus.Validated
                ? "The return does not reconcile to the VAT control account. Resolve the difference and prepare it again."
                : $"Only a reconciled return can be approved (this one is {Status}).";
        Status = VatReturnStatus.Approved;
        ApprovedByUserId = userId; ApprovedByName = userName; ApprovedAt = DateTime.UtcNow;
        Touch();
        return null;
    }

    /// <summary>Freezes the generated files. From here the figures can no longer change.</summary>
    public string? MarkReady(string fafContent, string returnXml, string contentHash)
    {
        if (Status != VatReturnStatus.Approved)
            return "Only an approved return can be marked ready to submit.";
        FafContent = fafContent; ReturnXml = returnXml; ContentHash = contentHash;
        IdempotencyKey = $"{Id:N}-{contentHash[..16]}";
        Status = VatReturnStatus.ReadyToSubmit;
        Touch();
        return null;
    }

    /// <summary>Opens a transmission attempt, or explains why one may not start.</summary>
    public (VatReturnAttempt? Attempt, string? Error) BeginAttempt(string environment, string? byName)
    {
        if (Status is VatReturnStatus.Submitted or VatReturnStatus.Acknowledged or VatReturnStatus.FiledViaPortal)
            return (null, "This return has already been submitted — it will not be sent again.");
        if (Status != VatReturnStatus.ReadyToSubmit && Status != VatReturnStatus.Rejected)
            return (null, "Only a return that is ready to submit can be sent.");
        if (Status == VatReturnStatus.Rejected)
            return (null, "The return was rejected. Correct the source records and prepare a new version before resubmitting.");
        if (Attempts.Any(a => a.Outcome == VatAttemptOutcome.InProgress))
            return (null, "A submission is already in progress for this return.");

        var attempt = new VatReturnAttempt(Id, Attempts.Count + 1, environment,
            IdempotencyKey ?? Id.ToString("N"), ContentHash, byName);
        Attempts.Add(attempt);
        Touch();
        return (attempt, null);
    }

    /// <summary>Records the gateway's actual answer and moves the return accordingly.</summary>
    public void CompleteAttempt(VatReturnAttempt attempt, string outcome, int? httpStatus,
        string? externalReference, string? message)
    {
        attempt.Complete(outcome, httpStatus, externalReference, message);
        switch (outcome)
        {
            case VatAttemptOutcome.Submitted:
                Status = VatReturnStatus.Submitted; Environment = attempt.Environment;
                SubmissionReference = externalReference; SubmittedAt = DateTime.UtcNow; break;
            case VatAttemptOutcome.Acknowledged:
                Status = VatReturnStatus.Acknowledged; Environment = attempt.Environment;
                SubmissionReference = externalReference;
                SubmittedAt ??= DateTime.UtcNow; AcknowledgedAt = DateTime.UtcNow; break;
            case VatAttemptOutcome.Rejected:
                Status = VatReturnStatus.Rejected; Environment = attempt.Environment;
                RejectionReason = message; break;
            // Failed / NotAvailable / AuthFailed: nothing reached FTA; the return stays ready to retry.
        }
        Touch();
    }

    /// <summary>
    /// Records that a person uploaded the generated file on EmaraTax themselves (FTA spec Option 1).
    /// Distinct from <c>submitted</c>: Vrodux did not transmit it and holds no response.
    /// </summary>
    public string? RecordPortalFiling(string reference, string? byName)
    {
        if (Status != VatReturnStatus.ReadyToSubmit)
            return "Only a return that is ready to submit can be recorded as filed on EmaraTax.";
        if (string.IsNullOrWhiteSpace(reference))
            return "Enter the EmaraTax reference shown after filing.";
        Status = VatReturnStatus.FiledViaPortal;
        SubmissionReference = reference.Trim(); SubmittedAt = DateTime.UtcNow; FiledByName = byName;
        Environment = "portal";
        Touch();
        return null;
    }

    public void Delete() { IsDeleted = true; Touch(); }

    private void Touch() => UpdatedAt = DateTime.UtcNow;
}

public static class VatAttemptOutcome
{
    public const string InProgress   = "in_progress";
    public const string Submitted    = "submitted";
    public const string Acknowledged = "acknowledged";
    public const string Rejected     = "rejected";
    /// <summary>Transport failure or timeout — safe to retry with the same idempotency key.</summary>
    public const string Failed       = "failed";
    public const string AuthFailed   = "auth_failed";
    /// <summary>No supported channel exists/is configured. Nothing was sent.</summary>
    public const string NotAvailable = "not_available";
}

/// <summary>One transmission attempt. Append-only audit of who sent what, where, and what came back.</summary>
public sealed class VatReturnAttempt
{
    private VatReturnAttempt() { }

    internal VatReturnAttempt(Guid vatReturnId, int attemptNumber, string environment,
        string idempotencyKey, string? contentHash, string? byName)
    {
        Id = Guid.NewGuid(); VatReturnId = vatReturnId; AttemptNumber = attemptNumber;
        Environment = environment; IdempotencyKey = idempotencyKey; ContentHash = contentHash;
        StartedByName = byName; StartedAt = DateTime.UtcNow; Outcome = VatAttemptOutcome.InProgress;
    }

    public Guid      Id                { get; private set; }
    public Guid      VatReturnId       { get; private set; }
    public int       AttemptNumber     { get; private set; }
    public string    Environment       { get; private set; } = string.Empty;
    public string    IdempotencyKey    { get; private set; } = string.Empty;
    public string?   ContentHash       { get; private set; }
    public string?   StartedByName     { get; private set; }
    public DateTime  StartedAt         { get; private set; }
    public DateTime? CompletedAt       { get; private set; }
    public string    Outcome           { get; private set; } = VatAttemptOutcome.InProgress;
    public int?      HttpStatus        { get; private set; }
    public string?   ExternalReference { get; private set; }
    /// <summary>Response text, already redacted and capped by the gateway.</summary>
    public string?   Message           { get; private set; }

    internal void Complete(string outcome, int? httpStatus, string? externalReference, string? message)
    {
        Outcome = outcome; HttpStatus = httpStatus; ExternalReference = externalReference;
        Message = message is { Length: > 2000 } ? message[..2000] : message;
        CompletedAt = DateTime.UtcNow;
    }
}
