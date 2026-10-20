using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.Extensions.Options;
using Softaxis.LeadGen.Application.Abstractions;
using Softaxis.LeadGen.Domain.Entities;
using Softaxis.LeadGen.Infrastructure.Options;

namespace Softaxis.LeadGen.Infrastructure.Mail;

public sealed record OAuthTokens(string AccessToken, string? RefreshToken, DateTime ExpiresAt);

internal sealed class MailSecrets
{
    public string? AccessToken { get; set; }
    public string? RefreshToken { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public string? Password { get; set; }
}

/// <summary>
/// Everything about proving who a mailbox is: the Google and Microsoft sign-in flows, and keeping
/// access tokens fresh. Stored credentials are encrypted at rest and decrypted only here, for the
/// moment they are needed.
/// </summary>
public interface IMailboxAuth
{
    bool GoogleConfigured { get; }
    bool MicrosoftConfigured { get; }
    bool IsConfigured(string provider);
    string BuildAuthUrl(string provider, string callbackUri, string state);
    Task<OAuthTokens> ExchangeCodeAsync(string provider, string code, string callbackUri, CancellationToken ct);
    Task<string?> GetAccountEmailAsync(string provider, string accessToken, CancellationToken ct);
    string ProtectOAuth(OAuthTokens tokens);
    string ProtectPassword(string password);
    Task<MailCredentials> ResolveAsync(Mailbox mailbox, CancellationToken ct);
}

internal sealed class MailboxAuth(IHttpClientFactory http, IOptions<LeadGenOptions> options, ISecretProtector protector) : IMailboxAuth
{
    private LeadGenOptions O => options.Value;

    private const string GoogleScopes = "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/userinfo.email";
    private const string MicrosoftScopes = "offline_access Mail.Send Mail.Read User.Read";

    public bool GoogleConfigured => O.Google.IsConfigured;
    public bool MicrosoftConfigured => O.Microsoft.IsConfigured;
    public bool IsConfigured(string provider) => provider switch
    {
        MailboxProvider.Google => GoogleConfigured, MailboxProvider.Microsoft => MicrosoftConfigured, _ => true,
    };

    private string MsTenant => string.IsNullOrWhiteSpace(O.Microsoft.Tenant) ? "common" : O.Microsoft.Tenant!;

    public string BuildAuthUrl(string provider, string callbackUri, string state) => provider == MailboxProvider.Google
        ? "https://accounts.google.com/o/oauth2/v2/auth" +
          $"?client_id={Uri.EscapeDataString(O.Google.ClientId!)}&redirect_uri={Uri.EscapeDataString(callbackUri)}" +
          $"&response_type=code&access_type=offline&prompt=consent&scope={Uri.EscapeDataString(GoogleScopes)}&state={Uri.EscapeDataString(state)}"
        : $"https://login.microsoftonline.com/{MsTenant}/oauth2/v2.0/authorize" +
          $"?client_id={Uri.EscapeDataString(O.Microsoft.ClientId!)}&redirect_uri={Uri.EscapeDataString(callbackUri)}" +
          $"&response_type=code&response_mode=query&prompt=consent&scope={Uri.EscapeDataString(MicrosoftScopes)}&state={Uri.EscapeDataString(state)}";

    public Task<OAuthTokens> ExchangeCodeAsync(string provider, string code, string callbackUri, CancellationToken ct) =>
        TokenAsync(provider, new Dictionary<string, string>
        {
            ["code"] = code, ["redirect_uri"] = callbackUri, ["grant_type"] = "authorization_code",
        }, keepRefresh: null, ct);

    private async Task<OAuthTokens> TokenAsync(string provider, Dictionary<string, string> form, string? keepRefresh, CancellationToken ct)
    {
        var google = provider == MailboxProvider.Google;
        form["client_id"] = google ? O.Google.ClientId! : O.Microsoft.ClientId!;
        form["client_secret"] = google ? O.Google.ClientSecret! : O.Microsoft.ClientSecret!;
        if (!google) form["scope"] = MicrosoftScopes;
        var endpoint = google ? "https://oauth2.googleapis.com/token" : $"https://login.microsoftonline.com/{MsTenant}/oauth2/v2.0/token";

        using var client = http.CreateClient("leadgen-api");
        using var res = await client.PostAsync(endpoint, new FormUrlEncodedContent(form), ct);
        var body = await res.Content.ReadAsStringAsync(ct);
        if (!res.IsSuccessStatusCode)
        {
            // invalid_grant: the user removed our access, or the refresh token aged out. Only they can fix it.
            if (body.Contains("invalid_grant", StringComparison.OrdinalIgnoreCase) || body.Contains("AADSTS70008", StringComparison.OrdinalIgnoreCase)
                || body.Contains("AADSTS50173", StringComparison.OrdinalIgnoreCase))
                throw new MailAuthException("Access was revoked or expired. Reconnect this mailbox.");
            throw new MailTransientException($"Sign-in with {(google ? "Google" : "Microsoft")} failed ({(int)res.StatusCode}).");
        }

        using var doc = JsonDocument.Parse(body);
        var root = doc.RootElement;
        var refresh = root.TryGetProperty("refresh_token", out var rt) ? rt.GetString() : keepRefresh;
        var seconds = root.TryGetProperty("expires_in", out var ei) ? ei.GetInt32() : 3600;
        return new OAuthTokens(root.GetProperty("access_token").GetString()!, refresh, DateTime.UtcNow.AddSeconds(seconds));
    }

    public async Task<string?> GetAccountEmailAsync(string provider, string accessToken, CancellationToken ct)
    {
        using var client = http.CreateClient("leadgen-api");
        using var req = new HttpRequestMessage(HttpMethod.Get, provider == MailboxProvider.Google
            ? "https://www.googleapis.com/oauth2/v2/userinfo" : "https://graph.microsoft.com/v1.0/me");
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        using var res = await client.SendAsync(req, ct);
        if (!res.IsSuccessStatusCode) return null;
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync(ct));
        var r = doc.RootElement;
        if (provider == MailboxProvider.Google) return r.TryGetProperty("email", out var e) ? e.GetString() : null;
        var mail = r.TryGetProperty("mail", out var m) ? m.GetString() : null;
        return !string.IsNullOrWhiteSpace(mail) ? mail : r.TryGetProperty("userPrincipalName", out var u) ? u.GetString() : null;
    }

    public string ProtectOAuth(OAuthTokens t) => protector.Protect(JsonSerializer.Serialize(
        new MailSecrets { AccessToken = t.AccessToken, RefreshToken = t.RefreshToken, ExpiresAt = t.ExpiresAt }))!;

    public string ProtectPassword(string password) => protector.Protect(JsonSerializer.Serialize(new MailSecrets { Password = password }))!;

    public async Task<MailCredentials> ResolveAsync(Mailbox mb, CancellationToken ct)
    {
        MailSecrets? secrets = null;
        if (!string.IsNullOrEmpty(mb.Credentials))
        {
            try { secrets = JsonSerializer.Deserialize<MailSecrets>(protector.Unprotect(mb.Credentials)!); }
            catch { throw new MailAuthException("The saved sign-in could not be read. Reconnect this mailbox."); }
        }
        if (secrets is null) throw new MailAuthException("This mailbox is not signed in. Reconnect it.");

        if (mb.Provider is MailboxProvider.Google or MailboxProvider.Microsoft)
        {
            if (string.IsNullOrEmpty(secrets.AccessToken) || secrets.ExpiresAt is null || secrets.ExpiresAt <= DateTime.UtcNow.AddMinutes(2))
            {
                if (string.IsNullOrEmpty(secrets.RefreshToken)) throw new MailAuthException("Access expired. Reconnect this mailbox.");
                var fresh = await TokenAsync(mb.Provider, new Dictionary<string, string>
                {
                    ["refresh_token"] = secrets.RefreshToken, ["grant_type"] = "refresh_token",
                }, secrets.RefreshToken, ct);
                secrets.AccessToken = fresh.AccessToken; secrets.RefreshToken = fresh.RefreshToken; secrets.ExpiresAt = fresh.ExpiresAt;
                mb.SetCredentials(protector.Protect(JsonSerializer.Serialize(secrets))!);   // the caller saves
            }
        }

        return new MailCredentials(mb.Id, mb.Provider, mb.Address, mb.DisplayName, secrets.AccessToken, secrets.Password,
            mb.Username, mb.SmtpHost, mb.SmtpPort, mb.ImapHost, mb.ImapPort);
    }
}

internal sealed class MailTransportFactory(IEnumerable<IMailTransport> transports) : IMailTransportFactory
{
    public IMailTransport For(string provider) =>
        transports.FirstOrDefault(t => t.Provider == provider) ?? throw new InvalidOperationException($"No mail transport for {provider}.");
}
