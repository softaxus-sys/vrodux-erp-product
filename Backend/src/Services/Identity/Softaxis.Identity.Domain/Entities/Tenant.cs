using Softaxis.BuildingBlocks.Domain.Primitives;
using Softaxis.Identity.Domain.Enums;

namespace Softaxis.Identity.Domain.Entities;

/// <summary>
/// Tenant aggregate root. Represents one client organisation.
/// Cloud tenants: Softaxis hosts DB. On-premises: client provides connection strings.
/// </summary>
public sealed class Tenant : AuditableEntity<Guid>
{
    // EF Core constructor
    private Tenant() { }

    private Tenant(
        Guid           id,
        string         name,
        string         slug,
        PlanType       plan,
        DeploymentType deploymentType,
        string?        contactEmail,
        string?        country) : base(id)
    {
        Name           = name;
        Slug           = slug;
        Plan           = plan;
        DeploymentType = deploymentType;
        ContactEmail   = contactEmail;
        Country        = country;
        Status         = TenantStatus.Trial;
        CreatedAt      = DateTime.UtcNow;
    }

    // ── Properties ────────────────────────────────────────────────────────────

    public string         Name           { get; private set; } = string.Empty;
    public string         Slug           { get; private set; } = string.Empty;
    public PlanType       Plan           { get; private set; }
    public DeploymentType DeploymentType { get; private set; }
    public TenantStatus   Status         { get; private set; }

    public string?   ContactEmail   { get; private set; }
    public string?   ContactPhone   { get; private set; }
    public string?   Country        { get; private set; }
    public string?   PrimaryColor   { get; private set; }

    /// <summary>
    /// Selected industry vertical (e.g. <c>real_estate</c>, <c>construction</c>).
    /// Drives the Industry Pack activated for this tenant. Null = generic (CRM only, no pack).
    /// </summary>
    public string?   Industry       { get; private set; }

    /// <summary>Encrypted JSON: { "IdentityDb": "...", "PosDb": "...", "InventoryDb": "..." }</summary>
    public string?   ConnectionStrings  { get; private set; }

    /// <summary>
    /// Optional super-admin override — JSON-serialized List&lt;string&gt; of module codes
    /// (e.g. <c>["pos","inventory"]</c>).  Null = use plan defaults.
    /// </summary>
    public string?   EnabledModules     { get; private set; }

    /// <summary>RSA-signed license key for on-prem deployments.</summary>
    public string?   LicenseKey         { get; private set; }
    public DateTime? LicenseExpiresAt   { get; private set; }
    public DateTime? LastHeartbeatAt    { get; private set; }
    public DateTime? TrialEndsAt        { get; private set; }

    // ── Derived ───────────────────────────────────────────────────────────────

    public PlanLimits Limits => PlanDefinitions.Get(Plan);

    /// <summary>Industry → Industry-Pack module code. Null industry = no pack.</summary>
    private static readonly Dictionary<string, string> IndustryPackModule = new(StringComparer.OrdinalIgnoreCase)
    {
        ["real_estate"] = "real-estate",
        ["construction"] = "construction",
        ["healthcare"]  = "healthcare",
        ["education"]   = "education",
        ["insurance"]   = "insurance",
        ["b2b_services"]= "b2b",
    };

    /// <summary>The Industry-Pack module code for a given industry, or null.</summary>
    public static string? PackModuleFor(string? industry) =>
        industry is not null && IndustryPackModule.TryGetValue(industry, out var m) ? m : null;

    /// <summary>
    /// Resolved module list: <see cref="EnabledModules"/> override when set,
    /// otherwise the plan-default modules. The active Industry-Pack module code
    /// (and <c>crm</c>, which packs build on) are always folded in.
    /// </summary>
    public IReadOnlyList<string> ResolvedModules
    {
        get
        {
            var list = (EnabledModules is not null
                ? System.Text.Json.JsonSerializer.Deserialize<List<string>>(EnabledModules)!
                : Limits.Modules.ToList()).ToList();

            var pack = PackModuleFor(Industry);
            if (pack is not null)
            {
                if (!list.Contains("crm"))  list.Add("crm");
                if (!list.Contains(pack))   list.Add(pack);
            }
            return list;
        }
    }

    public bool IsLicenseValid =>
        DeploymentType == DeploymentType.Cloud ||
        (LicenseKey is not null &&
         LicenseExpiresAt.HasValue &&
         LicenseExpiresAt.Value > DateTime.UtcNow);

    // ── Factory ───────────────────────────────────────────────────────────────

    public static Tenant Create(
        string         name,
        string         slug,
        PlanType       plan,
        DeploymentType deploymentType,
        string?        contactEmail = null,
        string?        country      = null,
        string?        industry     = null)
    {
        var t = new Tenant(Guid.NewGuid(), name, slug.ToLowerInvariant(), plan, deploymentType, contactEmail, country);
        t.Industry = industry;
        return t;
    }

    /// <summary>Set or change the tenant's industry (activates the matching Industry Pack).</summary>
    public void SetIndustry(string? industry)
    {
        Industry  = industry;
        UpdatedAt = DateTime.UtcNow;
    }

    // ── Behaviour ─────────────────────────────────────────────────────────────

    public void UpdateProfile(
        string  name,
        string? contactEmail,
        string? contactPhone,
        string? country,
        string? primaryColor)
    {
        Name         = name;
        ContactEmail = contactEmail;
        ContactPhone = contactPhone;
        Country      = country;
        PrimaryColor = primaryColor;
        UpdatedAt    = DateTime.UtcNow;
    }

    public void ChangePlan(PlanType newPlan)
    {
        Plan      = newPlan;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Activate()
    {
        Status    = TenantStatus.Active;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Suspend()
    {
        Status    = TenantStatus.Suspended;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetLicenseKey(string licenseKey, DateTime expiresAt)
    {
        LicenseKey       = licenseKey;
        LicenseExpiresAt = expiresAt;
        UpdatedAt        = DateTime.UtcNow;
    }

    /// <summary>
    /// Renew subscription for cloud tenants. Sets the new expiry date and activates the account.
    /// For on-premises tenants, use GenerateLicense instead (RSA-signed key required).
    /// </summary>
    public void RenewSubscription(DateTime expiresAt)
    {
        LicenseExpiresAt = expiresAt;
        Status           = TenantStatus.Active;
        UpdatedAt        = DateTime.UtcNow;
    }

    /// <summary>Mark tenant as expired (automated job or manual super-admin action).</summary>
    public void Expire()
    {
        Status    = TenantStatus.Expired;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetConnectionStrings(string encryptedJson)
    {
        ConnectionStrings = encryptedJson;
        UpdatedAt         = DateTime.UtcNow;
    }

    /// <summary>
    /// Override the module list for this tenant.
    /// Pass <see langword="null"/> to reset to plan defaults.
    /// </summary>
    public void SetEnabledModules(IReadOnlyList<string>? modules)
    {
        EnabledModules = modules is null
            ? null
            : System.Text.Json.JsonSerializer.Serialize(modules);
        UpdatedAt = DateTime.UtcNow;
    }

    public void RecordHeartbeat()
    {
        LastHeartbeatAt = DateTime.UtcNow;
        UpdatedAt       = DateTime.UtcNow;
    }

    public void StartTrial(int trialDays = 30)
    {
        Status      = TenantStatus.Trial;
        TrialEndsAt = DateTime.UtcNow.AddDays(trialDays);
        UpdatedAt   = DateTime.UtcNow;
    }
}
