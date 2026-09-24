namespace Softaxis.Seo.Domain.Entities;

/// <summary>
/// A site's OAuth connection to Google. Search Console + Analytics share one consent screen
/// (both scopes requested together — see GoogleOAuthClient), so there is one integration row
/// per site, not one per Google product. Mirrors CRM's <c>Integration</c> entity shape.
/// </summary>
public sealed class SeoGoogleIntegration
{
    private SeoGoogleIntegration() { }

    public SeoGoogleIntegration(Guid siteId)
    {
        Id        = Guid.NewGuid();
        SiteId    = siteId;
        Status    = "disconnected";
        CreatedAt = DateTime.UtcNow;
    }

    public Guid     Id          { get; private set; }
    public Guid     SiteId      { get; private set; }
    public string   Status      { get; private set; } = "disconnected"; // disconnected | connected | error
    /// <summary>Encrypted JSON: refresh token, access token, expiry, connected account email. NEVER returned to the client.</summary>
    public string?  Credentials { get; private set; }
    public string?  LastError   { get; private set; }

    public bool      IsDeleted { get; private set; }
    public DateTime  CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }

    public void SetCredentials(string encrypted) { Credentials = encrypted; Status = "connected"; LastError = null; Touch(); }
    public void RecordError(string error)        { LastError = error.Length > 500 ? error[..500] : error; Status = "error"; Touch(); }
    public void Disconnect()                     { Credentials = null; Status = "disconnected"; Touch(); }

    private void Touch() => UpdatedAt = DateTime.UtcNow;
}
