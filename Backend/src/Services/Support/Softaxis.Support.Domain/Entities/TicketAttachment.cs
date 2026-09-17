namespace Softaxis.Support.Domain.Entities;

/// <summary>
/// A file attached to a ticket message (a screenshot, log file, etc.). Stored as a data URI on
/// the row itself — this codebase's established pattern for small assets with no dedicated blob
/// store (Employee.AvatarData, company logo), rather than standing up new file-storage
/// infrastructure for a v1. Deliberately small: validated by <c>TicketAttachmentLimits</c> at the
/// command layer, not here — the entity itself just holds what it's given.
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
    public string   DataUri          { get; private set; } = string.Empty;
    public long     SizeBytes        { get; private set; }
    public Guid     UploadedByUserId { get; private set; }
    public string   UploadedByName   { get; private set; } = string.Empty;
    public DateTime CreatedAt        { get; private set; }
}
