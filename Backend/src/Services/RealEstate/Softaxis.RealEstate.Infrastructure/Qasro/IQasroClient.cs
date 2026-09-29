namespace Softaxis.RealEstate.Infrastructure.Qasro;

/// <summary>
/// Real OAuth against Qasro's own login/signup — not a blind server-to-server push. The tenant
/// admin is redirected to Qasro, logs in (or signs up) there, and the connection only proceeds if
/// their agency is approved and active on Qasro's side. That approval gate is enforced entirely by
/// Qasro; this client only ever sees the outcome (approved + an agency id, or a refusal).
///
/// The actual listing DATA flow is unchanged from the "own website" integration this reuses: once
/// connected, Qasro pulls published listings from PublicListingsController using a key Vrodux
/// generates locally and hands over in RegisterPullKeyAsync — the one server-to-server call in this
/// whole flow, and it only happens after the OAuth approval above has already succeeded.
/// </summary>
public interface IQasroClient
{
    /// <summary>Qasro's own login/signup + connection-approval page. <paramref name="companyNameHint"/>
    /// only pre-fills Qasro's form — Qasro decides what account this actually resolves to.</summary>
    string BuildAuthorizeUrl(string redirectUri, string state, string companyNameHint);

    /// <summary>
    /// Server-to-server exchange of the redirect's <c>code</c> for Qasro's own confirmation that a
    /// real, approved agency backs it. Throws QasroNotApprovedException specifically when the code
    /// is valid but the agency isn't approved/active yet, so the caller can show that distinctly
    /// from "something went wrong".
    /// </summary>
    Task<string> ExchangeCodeAsync(string code, string redirectUri, CancellationToken ct);

    /// <summary>Hands Qasro the locally-generated pull key once approval is confirmed — the one
    /// piece of data this side pushes, and only after the OAuth handshake above already succeeded.</summary>
    Task RegisterPullKeyAsync(string qasroAgencyId, string apiKey, string listingsApiBaseUrl, CancellationToken ct);

    /// <summary>Tells Qasro to stop pulling and take the agency's listings down. Best-effort — a
    /// failure here should not block a local disconnect (see DisconnectQasroHandler).</summary>
    Task UnlinkAgencyAsync(string qasroAgencyId, CancellationToken ct);
}

/// <summary>The code was valid, but Qasro's own approval gate rejected it — a distinct outcome from
/// a bad/expired code, so the tenant sees "your agency isn't approved yet", not a generic failure.</summary>
public sealed class QasroNotApprovedException(string message) : Exception(message);
