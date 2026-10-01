using Softaxis.BuildingBlocks.Application.Storage;
using Softaxis.Support.Application.Tickets.Dtos;
using Softaxis.Support.Domain.Entities;

namespace Softaxis.Support.Infrastructure.Handlers.Tickets;

internal static class TicketMappings
{
    public static TicketSummaryDto ToSummaryDto(SupportTicket t, int messageCount) => new(
        t.Id, t.TicketNumber, t.RequestingTenantId, t.RequestingTenantName,
        t.RequestingUserId, t.RequestingUserName, t.Subject, t.Category, t.Priority, t.Status,
        t.AssignedToUserId, t.AssignedToUserName, messageCount, t.CreatedAt, t.UpdatedAt, t.ClosedAt);

    /// <summary>Reconstructs the data URI the frontend has always embedded inline — from the
    /// bucket when ObjectKey is set, from the legacy column otherwise. Keeps the existing
    /// "no separate download endpoint" contract so no frontend change was needed for this
    /// migration. A bucket read failure falls back to whatever DataUri the row still has (empty
    /// for a bucket-backed row, which just renders as a broken attachment rather than a 500 —
    /// the same "never block on a secondary concern" posture as the upload side).</summary>
    public static async Task<TicketAttachmentDto> ToDtoAsync(
        TicketAttachment a, IObjectStorage storage, CancellationToken ct)
    {
        if (a.ObjectKey is { } key)
        {
            var file = await storage.GetAsync(key, ct);
            if (file is not null)
            {
                var dataUri = $"data:{file.ContentType};base64,{Convert.ToBase64String(file.Data)}";
                return new(a.Id, a.FileName, file.ContentType, dataUri, a.SizeBytes, a.UploadedByName, a.CreatedAt);
            }
        }
        return new(a.Id, a.FileName, a.ContentType, a.DataUri, a.SizeBytes, a.UploadedByName, a.CreatedAt);
    }

    public static async Task<TicketMessageDto> ToDtoAsync(
        TicketMessage m, IReadOnlyList<TicketAttachment> attachments, IObjectStorage storage, CancellationToken ct)
    {
        var own = attachments.Where(a => a.MessageId == m.Id).ToList();
        var dtos = new List<TicketAttachmentDto>(own.Count);
        foreach (var a in own) dtos.Add(await ToDtoAsync(a, storage, ct));
        return new(m.Id, m.AuthorUserId, m.AuthorName, m.IsFromAgent, m.Body, m.CreatedAt, dtos);
    }

    public static TicketAssignmentDto ToDto(TicketAssignment a) =>
        new(a.Id, a.FromUserId, a.FromUserName, a.ToUserId, a.ToUserName, a.ChangedByName, a.Note, a.CreatedAt);

    public static async Task<TicketDetailDto> ToDetailDtoAsync(
        SupportTicket t, IReadOnlyList<TicketMessage> messages, IReadOnlyList<TicketAssignment> history,
        IReadOnlyList<TicketAttachment> attachments, IObjectStorage storage, CancellationToken ct)
    {
        var orderedMessages = messages.OrderBy(m => m.CreatedAt).ToList();
        var messageDtos = new List<TicketMessageDto>(orderedMessages.Count);
        foreach (var m in orderedMessages) messageDtos.Add(await ToDtoAsync(m, attachments, storage, ct));

        return new(
            t.Id, t.TicketNumber, t.RequestingTenantId, t.RequestingTenantName,
            t.RequestingUserId, t.RequestingUserName, t.RequestingUserEmail,
            t.Subject, t.Category, t.Priority, t.Status, t.AssignedToUserId, t.AssignedToUserName,
            messageDtos,
            history.OrderByDescending(a => a.CreatedAt).Select(ToDto).ToList(),
            t.CreatedAt, t.UpdatedAt, t.ClosedAt);
    }
}
