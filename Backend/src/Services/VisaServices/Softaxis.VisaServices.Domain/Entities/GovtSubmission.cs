namespace Softaxis.VisaServices.Domain.Entities;

/// <summary>
/// One government transaction submitted for a case (entry permit, status change, Emirates ID,
/// stamping…). A case has several over its life. In manual mode the PRO records the external
/// reference + status; real channel adapters (Phase 4+) will populate these automatically.
/// </summary>
public sealed class GovtSubmission
{
    private GovtSubmission() { }

    public GovtSubmission(Guid visaCaseId, string channel, string submissionType,
        string? externalReference, string? notes)
    {
        Id                = Guid.NewGuid();
        VisaCaseId        = visaCaseId;
        Channel           = channel.Trim().ToLowerInvariant();
        SubmissionType    = submissionType.Trim();
        ExternalReference = externalReference?.Trim();
        Status            = "submitted";
        Notes             = notes?.Trim();
        SubmittedAt       = DateTime.UtcNow;
        CreatedAt         = DateTime.UtcNow;
    }

    public Guid      Id                { get; private set; }
    public Guid      VisaCaseId        { get; private set; }
    public string    Channel           { get; private set; } = "manual";
    // entry_permit | status_change | emirates_id | stamping | medical | other
    public string    SubmissionType    { get; private set; } = string.Empty;
    public string?   ExternalReference { get; private set; }
    // submitted | in_review | approved | rejected | completed
    public string    Status            { get; private set; } = "submitted";
    public string?   Notes             { get; private set; }
    public DateTime  SubmittedAt       { get; private set; }
    public DateTime  CreatedAt         { get; private set; }
    public DateTime? UpdatedAt         { get; private set; }

    public void SetStatus(string status, string? externalReference, string? notes)
    {
        Status = status;
        if (!string.IsNullOrWhiteSpace(externalReference)) ExternalReference = externalReference.Trim();
        if (notes is not null) Notes = notes.Trim();
        UpdatedAt = DateTime.UtcNow;
    }
}
