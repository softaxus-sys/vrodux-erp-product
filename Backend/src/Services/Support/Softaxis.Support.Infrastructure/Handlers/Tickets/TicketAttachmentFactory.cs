using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.Storage;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.BuildingBlocks.Infrastructure.Storage;
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
/// entity upgraded via <see cref="TicketAttachment.SetObjectKey"/>. An INFRASTRUCTURE upload
/// failure (bucket down, network) is swallowed, not surfaced: a support attachment isn't
/// consequential enough to fail the whole ticket/reply over, unlike HR/CRM documents. A storage
/// QUOTA failure is different — that's a deliberate policy decision, not a hiccup, so it fails the
/// whole call the same way HR/CRM/RealEstate do, rather than quietly falling back to inline
/// storage (which would both defeat the quota and not even count toward it).</para></summary>
internal static class TicketAttachmentFactory
{
    public static async Task<Result<List<TicketAttachment>>> BuildAsync(
        Guid ticketId, Guid messageId, IReadOnlyList<AttachmentInput>? inputs,
        Guid uploadedByUserId, string uploadedByName,
        IObjectStorage storage, IImageProcessor imageProcessor, Guid? tenantId,
        DatabaseFacade database, ILogger logger, CancellationToken ct)
    {
        if (inputs is null || inputs.Count == 0) return Result.Success(new List<TicketAttachment>());

        var result = new List<TicketAttachment>(inputs.Count);
        // Tracks bytes already accepted earlier in THIS batch, so a second/third attachment in the
        // same message is checked against what the first one(s) already committed, not just the
        // tenant's usage as of before this call started.
        long committedInBatch = 0;

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

                var quota = await TenantStorageQuota.CheckAsync(
                    database, tid, committedInBatch + data.LongLength, ct);
                if (!quota.Allowed)
                    return Result.Failure<List<TicketAttachment>>(Error.Custom("TicketAttachment.QuotaExceeded",
                        TenantStorageQuota.QuotaErrorMessage(quota, input.FileName)));

                var key = $"support/{tid:N}/{ticketId:N}/{attachment.Id:N}";
                try
                {
                    await storage.PutAsync(key, data, contentType, ct);
                    attachment.SetObjectKey(key, contentType, data.LongLength);
                    committedInBatch += data.LongLength;
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
        return Result.Success(result);
    }
}
