namespace Softaxis.Support.Domain.Entities;

/// <summary>
/// One message in a ticket's thread — either from the requesting tenant's user or from a
/// Softaxis support agent. <see cref="IsFromAgent"/> drives which side of the thread it renders
/// on and which party gets emailed when it's added.
/// </summary>
public sealed class TicketMessage
{
    private TicketMessage() { }

    public TicketMessage(Guid ticketId, Guid authorUserId, string authorName, bool isFromAgent, string body)
    {
        Id           = Guid.NewGuid();
        TicketId     = ticketId;
        AuthorUserId = authorUserId;
        AuthorName   = authorName.Trim();
        IsFromAgent  = isFromAgent;
        Body         = body.Trim();
        CreatedAt    = DateTime.UtcNow;
    }

    public Guid     Id           { get; private set; }
    public Guid     TicketId     { get; private set; }
    public Guid     AuthorUserId { get; private set; }
    public string   AuthorName   { get; private set; } = string.Empty;
    public bool     IsFromAgent  { get; private set; }
    public string   Body         { get; private set; } = string.Empty;
    public DateTime CreatedAt    { get; private set; }
}
