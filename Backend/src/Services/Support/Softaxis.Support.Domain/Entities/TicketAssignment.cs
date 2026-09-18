namespace Softaxis.Support.Domain.Entities;

/// <summary>
/// Append-only handoff record for a ticket — mirrors CRM's <c>LeadAssignment</c> pattern. Every
/// assign/reassign/unassign writes one row here, so the queue can show who has touched a ticket
/// and when, independent of the ticket's own current <see cref="Entities.SupportTicket.AssignedToUserId"/>.
/// </summary>
public sealed class TicketAssignment
{
    private TicketAssignment() { }

    public TicketAssignment(
        Guid ticketId,
        Guid? fromUserId, string? fromUserName,
        Guid? toUserId, string? toUserName,
        Guid changedByUserId, string changedByName, string? note)
    {
        Id              = Guid.NewGuid();
        TicketId        = ticketId;
        FromUserId      = fromUserId;
        FromUserName    = fromUserName?.Trim();
        ToUserId        = toUserId;
        ToUserName      = toUserName?.Trim();
        ChangedByUserId = changedByUserId;
        ChangedByName   = changedByName.Trim();
        Note            = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
        CreatedAt       = DateTime.UtcNow;
    }

    public Guid     Id              { get; private set; }
    public Guid     TicketId        { get; private set; }
    public Guid?    FromUserId      { get; private set; }
    public string?  FromUserName    { get; private set; }
    public Guid?    ToUserId        { get; private set; }
    public string?  ToUserName      { get; private set; }
    public Guid     ChangedByUserId { get; private set; }
    public string   ChangedByName   { get; private set; } = string.Empty;
    public string?  Note            { get; private set; }
    public DateTime CreatedAt       { get; private set; }
}
