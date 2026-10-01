namespace Softaxis.Support.Domain.Entities;

/// <summary>
/// A file attached to a ticket message (a screenshot, log file, etc.).
///
/// <para>Bytes live in the shared object storage bucket (see IObjectStorage) once configured —
/// <see cref="ObjectKey"/> set, <see cref="DataUri"/> cleared. A row uploaded before object
/// storage was configured (or if a bucket upload fails — a support attachment is not consequential
/// enough to fail the whole message over) keeps its bytes as a data URI on the row itself instead;
/// the two are never both populated. Deliberately small either way: validated by
/// <c>TicketAttachmentLimits</c> at the command layer, not here — the entity itself just holds
/// what it's given.</para>
/// </summary>
public sealed class TicketAttachment
{
    private TicketAttachment() { }

    public TicketAttachment(
        Guid ticketId, Guid messageId, string fileName, string contentType, string dataUri,
        long sizeBytes, Guid uploadedByUserId, string uploadedByName)
    {
        Id                = Guid.NewGuid();
        TicketId          = ticketId;
        MessageId         = messageId;
        FileName          = fileName.Trim();
        ContentType       = contentType.Trim();
        DataUri           = dataUri;
        SizeBytes         = sizeBytes;
        UploadedByUserId  = uploadedByUserId;
        UploadedByName    = uploadedByName.Trim();
        CreatedAt         = DateTime.UtcNow;
    }

    public Guid     Id               { get; private set; }
    public Guid     TicketId         { get; private set; }
    public Guid     MessageId        { get; private set; }
    public string   FileName         { get; private set; } = string.Empty;
    public string   ContentType      { get; private set; } = string.Empty;

    /// <summary>Legacy storage (base64 data URI) — empty once ObjectKey is set. Never both
    /// populated, so the bytes aren't paid for twice.</summary>
    public string   DataUri          { get; private set; } = string.Empty;

    /// <summary>Key in the shared object storage bucket, e.g. "support/{tenantId}/{ticketId}/
    /// {attachmentId}". Null for a row stored the legacy way.</summary>
    public string?  ObjectKey        { get; private set; }

    public long     SizeBytes        { get; private set; }
    public Guid     UploadedByUserId { get; private set; }
    public string   UploadedByName   { get; private set; } = string.Empty;
    public DateTime CreatedAt        { get; private set; }

    /// <summary>Called once the bytes have actually landed in the bucket. ContentType/SizeBytes
    /// are updated too — compression may have changed the re-encoded format/size — and DataUri is
    /// cleared, since the two storage locations are never both populated for the same row.</summary>
    public void SetObjectKey(string key, string contentType, long sizeBytes)
    {
        ObjectKey   = key;
        ContentType = contentType;
        SizeBytes   = sizeBytes;
        DataUri     = string.Empty;
    }
}
