using Softaxis.Support.Application.Tickets.Commands;
using Softaxis.Support.Domain.Entities;

namespace Softaxis.Support.Infrastructure.Handlers.Tickets;

/// <summary>Builds attachment entities from the validated request inputs. Size/type/count are
/// already enforced by <see cref="AttachmentInputValidator"/> before a handler ever sees these —
/// this only computes the decoded byte size for storage (SupportTicket.SizeBytes), never re-checks
/// the limits themselves, so the two never disagree on what "too big" means.</summary>
internal static class TicketAttachmentFactory
{
    public static List<TicketAttachment> Build(
        Guid ticketId, Guid messageId, IReadOnlyList<AttachmentInput>? inputs,
        Guid uploadedByUserId, string uploadedByName)
    {
        if (inputs is null || inputs.Count == 0) return [];

        var result = new List<TicketAttachment>(inputs.Count);
        foreach (var input in inputs)
        {
            TicketAttachmentLimits.TryGetSizeBytes(input.DataUri, out var sizeBytes);
            result.Add(new TicketAttachment(
                ticketId, messageId, input.FileName, input.ContentType, input.DataUri,
                sizeBytes, uploadedByUserId, uploadedByName));
        }
        return result;
    }
}
