using Softaxis.CRM.Application.LeadIntake.Dtos;
using Softaxis.CRM.Domain.Entities.Integrations;

namespace Softaxis.CRM.Application.LeadIntake.Abstractions;

/// <summary>
/// The plug-in contract every lead source implements. Adding a new integration is:
///   1. implement <see cref="ILeadProvider"/> (+ optional capability interfaces below),
///   2. register it in DI.
/// No CRM / pipeline code changes. Resolve providers via <see cref="ILeadProviderRegistry"/>.
/// </summary>
public interface ILeadProvider
{
    /// <summary>Stable lower-case key, e.g. "meta", "google-ads", "webhook". Matches <c>Integration.ProviderKey</c>.</summary>
    string Key { get; }

    ProviderDescriptor Descriptor { get; }

    /// <summary>
    /// Turn a raw inbound payload (webhook body, poll response item, etc.) into zero or
    /// more canonical leads. Implementations should be pure — no DB / network side effects.
    /// </summary>
    IReadOnlyList<CanonicalLead> Normalize(string rawPayload, Integration integration);
}

/// <summary>Providers connected via an OAuth redirect (Meta, Google, LinkedIn, TikTok…).</summary>
public interface IOAuthLeadProvider : ILeadProvider
{
    /// <summary>Build the provider authorize URL the user is redirected to.</summary>
    string BuildAuthorizationUrl(string redirectUri, string state);

    /// <summary>Exchange the returned code for tokens and persist them (encrypted) on the integration.</summary>
    Task<OAuthResult> ExchangeCodeAsync(string code, string redirectUri, CancellationToken ct);

    /// <summary>Refresh an access token when supported. Returns null when not applicable.</summary>
    Task<OAuthResult?> RefreshAsync(Integration integration, CancellationToken ct);
}

/// <summary>Providers that receive pushed payloads at an inbound URL.</summary>
public interface IWebhookLeadProvider : ILeadProvider
{
    /// <summary>Handle a provider verification handshake (e.g. Meta hub.challenge). Null if not a handshake.</summary>
    string? TryHandleVerification(IReadOnlyDictionary<string, string> query, Integration integration);

    /// <summary>Verify the authenticity of an inbound payload (HMAC signature, shared secret…).</summary>
    bool VerifySignature(string rawBody, IReadOnlyDictionary<string, string> headers, string? decryptedSecret);
}

/// <summary>Providers whose leads are pulled on a schedule by the background sync service.</summary>
public interface IPollSyncLeadProvider : ILeadProvider
{
    /// <summary>Fetch new leads since the integration's last successful sync.</summary>
    Task<IReadOnlyList<CanonicalLead>> FetchAsync(Integration integration, CancellationToken ct);
}

/// <summary>
/// Providers whose inbound payload only references a lead (e.g. Meta sends a leadgen_id) and
/// must call back to the provider API to retrieve the full record. The inbox processor prefers
/// <see cref="NormalizeAsync"/> over the synchronous <see cref="ILeadProvider.Normalize"/>.
/// </summary>
public interface IAsyncLeadProvider : ILeadProvider
{
    Task<IReadOnlyList<CanonicalLead>> NormalizeAsync(string rawPayload, Integration integration, CancellationToken ct);
}

public sealed record OAuthResult(
    string AccessToken,
    string? RefreshToken,
    DateTime? ExpiresAt,
    string? AccountName);
