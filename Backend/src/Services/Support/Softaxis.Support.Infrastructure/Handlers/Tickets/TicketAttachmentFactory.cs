using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.Storage;
using Softaxis.Support.Application.Tickets.Commands;
using Softaxis.Support.Domain.Entities;

namespace Softaxis.Support.Infrastructure.Handlers.Tickets;

/// <summary>Builds attachment entities from the validated request inputs. Size/type/count are
/// already enforced by <see cref="AttachmentInputValidator"/> before a handler ever sees these —
/// this only computes the decoded byte size for storage (SupportTicket.SizeBytes), never re-checks
/// the limits themselves, so the two never disagree on what "too big" means.
///
/// <para>Each attachment is constructed with its original data URI first (so there's always a
/// usable fallback), then — when object storage is configured — uploaded to the bucket and the
/// entity upgraded via <see cref="TicketAttachment.SetObjectKey"/>. A bucket upload failure is
/// swallowed, not surfaced: a support attachment isn't consequential enough to fail the whole
/// ticket/reply over, unlike HR/CRM documents.</para></summary>
internal static class TicketAttachmentFactory
{
    public static async Task<List<TicketAttachment>> BuildAsync(
        Guid ticketId, Guid messageId, IReadOnlyList<AttachmentInput>? inputs,
        Guid uploadedByUserId, string uploadedByName,
        IObjectStorage storage, IImageProcessor imageProcessor, Guid? tenantId,
        ILogger logger, CancellationToken ct)
    {
        if (inputs is null || inputs.Count == 0) return [];

        var result = new List<TicketAttachment>(inputs.Count);
        foreach (var input in inputs)
        {
            TicketAttachmentLimits.TryGetSizeBytes(input.DataUri, out var sizeBytes);
            var attachment = new TicketAttachment(
                ticketId, messageId, input.FileName, input.ContentType, input.DataUri,
                sizeBytes, uploadedByUserId, uploadedByName);

            if (storage.IsConfigured && tenantId is { } tid &&
                TicketAttachmentLimits.TryDecodeBytes(input.DataUri, out var bytes))
            {
                var (data, contentType) = imageProcessor.IsCompressibleImage(input.ContentType)
                    ? imageProcessor.Compress(bytes, input.ContentType)
                    : (bytes, input.ContentType);

                var key = $"support/{tid:N}/{ticketId:N}/{attachment.Id:N}";
                try
                {
                    await storage.PutAsync(key, data, contentType, ct);
                    attachment.SetObjectKey(key, contentType, data.LongLength);
                }
                catch (Exception ex)
                {
                    logger.LogError(ex,
                        "Ticket attachment upload to object storage failed (key {Key}, ticket {TicketId}) — keeping it inline",
                        key, ticketId);
                }
            }

            result.Add(attachment);
        }
        return result;
    }
}
