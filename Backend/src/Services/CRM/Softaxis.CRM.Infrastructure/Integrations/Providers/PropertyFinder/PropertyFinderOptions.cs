namespace Softaxis.CRM.Infrastructure.Integrations.Providers.PropertyFinder;

/// <summary>
/// Deployment-level Property Finder settings.
///
/// <para><b>No credentials here, by design.</b> A Property Finder API key belongs to one agency, so
/// a key in shared configuration would be used by every tenant on the deployment — one agency
/// importing another agency's agents and enquiries. Each tenant's key/secret is stored encrypted on
/// its own <c>Integration</c> row instead (see <see cref="PropertyFinderCredentialStore"/>).</para>
///
/// <para>Only the API address lives here, because it is the same for everyone and is not a secret.</para>
/// </summary>
public sealed class PropertyFinderOptions
{
    public const string Section = "PropertyFinder";

    public string BaseUrl { get; set; } = "https://atlas.propertyfinder.com";
}
