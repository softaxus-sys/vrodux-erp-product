namespace Softaxis.Seo.Domain.Entities;

/// <summary>
/// A site's optional WordPress connection — lets an approved article be pushed straight into the
/// tenant's WP install rather than only copy/exported. Authenticated with a WP "Application Password"
/// (WordPress's own scoped-credential feature, not the account's real login password), encrypted at
/// rest the same way Google's OAuth tokens are. Entirely optional: a site with no connection can still
/// generate and review articles, just without the one-click push.
/// </summary>
public sealed class SeoWordPressConnection
{
    private SeoWordPressConnection() { }

    public SeoWordPressConnection(Guid siteId, string siteUrl, string username, string encryptedAppPassword)
    {
        Id            = Guid.NewGuid();
        SiteId        = siteId;
        SiteUrl       = NormalizeUrl(siteUrl);
        Username      = username.Trim();
        AppPassword   = encryptedAppPassword;
        Status        = "connected";
        AutoPublish   = false; // opt-in only — see the module's own remarks on why the safe default is a WP draft
        CreatedAt     = DateTime.UtcNow;
    }

    public Guid     Id          { get; private set; }
    public Guid     SiteId      { get; private set; }
    public string   SiteUrl     { get; private set; } = string.Empty;
    public string   Username    { get; private set; } = string.Empty;
    /// <summary>Encrypted at rest. NEVER returned to the client.</summary>
    public string   AppPassword { get; private set; } = string.Empty;
    public string   Status      { get; private set; } = "connected"; // connected | error
    public string?  LastError   { get; private set; }
    /// <summary>false (default) = push lands as a WP draft, so a human still gives it a final look
    /// inside WordPress before it goes live. true = push publishes immediately — explicit opt-in.</summary>
    public bool     AutoPublish { get; private set; }

    public bool      IsDeleted { get; private set; }
    public DateTime  CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }

    public void RecordError(string error) { LastError = error.Length > 500 ? error[..500] : error; Status = "error"; Touch(); }
    public void RecordHealthy()            { LastError = null; Status = "connected"; Touch(); }
    public void SetAutoPublish(bool value) { AutoPublish = value; Touch(); }
    public void Delete()                   { IsDeleted = true; Touch(); }

    private void Touch() => UpdatedAt = DateTime.UtcNow;

    private static string NormalizeUrl(string url)
    {
        var u = url.Trim().TrimEnd('/');
        return u.StartsWith("http://", StringComparison.OrdinalIgnoreCase) || u.StartsWith("https://", StringComparison.OrdinalIgnoreCase)
            ? u : $"https://{u}";
    }
}
