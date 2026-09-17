using Softaxis.Support.Application.Tickets.Dtos;
using Softaxis.Support.Domain.Entities;

namespace Softaxis.Support.Infrastructure.Handlers.Tickets;

internal static class TicketMappings
{
    public static TicketSummaryDto ToSummaryDto(SupportTicket t, int messageCount) => new(
        t.Id, t.TicketNumber, t.RequestingTenantId, t.RequestingTenantName,
        t.RequestingUserId, t.RequestingUserName, t.Subject, t.Category, t.Priority, t.Status,
        t.AssignedToUserId, t.AssignedToUserName, messageCount, t.CreatedAt, t.UpdatedAt, t.ClosedAt);

    public static TicketAttachmentDto ToDto(TicketAttachment a) =>
        new(a.Id, a.FileName, a.ContentType, a.DataUri, a.SizeBytes, a.UploadedByName, a.CreatedAt);

    public static TicketMessageDto ToDto(TicketMessage m, IReadOnlyList<TicketAttachment> attachments) =>
        new(m.Id, m.AuthorUserId, m.AuthorName, m.IsFromAgent, m.Body, m.CreatedAt,
            attachments.Where(a => a.MessageId == m.Id).Select(ToDto).ToList());

    public static TicketAssignmentDto ToDto(TicketAssignment a) =>
        new(a.Id, a.FromUserId, a.FromUserName, a.ToUserId, a.ToUserName, a.ChangedByName, a.Note, a.CreatedAt);

    public static TicketDetailDto ToDetailDto(SupportTicket t, IReadOnlyList<TicketMessage> messages,
        IReadOnlyList<TicketAssignment> history, IReadOnlyList<TicketAttachment> attachments) => new(
        t.Id, t.TicketNumber, t.RequestingTenantId, t.RequestingTenantName,
        t.RequestingUserId, t.RequestingUserName, t.RequestingUserEmail,
        t.Subject, t.Category, t.Priority, t.Status, t.AssignedToUserId, t.AssignedToUserName,
        messages.OrderBy(m => m.CreatedAt).Select(m => ToDto(m, attachments)).ToList(),
        history.OrderByDescending(a => a.CreatedAt).Select(ToDto).ToList(),
        t.CreatedAt, t.UpdatedAt, t.ClosedAt);
}
