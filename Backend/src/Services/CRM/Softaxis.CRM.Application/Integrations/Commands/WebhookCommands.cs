using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.CRM.Application.Integrations.Commands;

/// <summary>
/// Anonymous inbound payload from a provider (webhook / custom API / website form).
/// Resolved to a tenant via <paramref name="InboundKey"/>, signature-verified, then stored
/// in the durable inbox and acknowledged immediately — the background processor runs intake.
/// </summary>
public sealed record IngestWebhookCommand(
    string InboundKey,
    string RawBody,
    IReadOnlyDictionary<string, string> Headers) : ICommand<WebhookAck>;

public sealed record WebhookAck(bool Received, Guid? InboxId, string? Message);
