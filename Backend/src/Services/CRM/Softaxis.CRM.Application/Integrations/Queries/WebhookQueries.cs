using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.CRM.Application.Integrations.Queries;

/// <summary>
/// Provider verification handshake (e.g. Meta's hub.challenge GET). Returns the challenge
/// string to echo back, or empty when the request is not a handshake.
/// </summary>
public sealed record VerifyWebhookQuery(
    string InboundKey,
    IReadOnlyDictionary<string, string> Query) : IQuery<string>;
