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
    /// The tenant's operating/display currency (3-letter ISO code, e.g. <c>USD</c>, <c>PKR</c>).
    /// Chosen at signup from the browser locale; USD is the exchange-rate base. Null = USD default.
    /// </summary>
    public string?   Currency       { get; private set; }

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

    // ── Signup attribution + trial dunning ────────────────────────────────────

    /// <summary><c>utm_source</c> captured from the pricing-page link that produced this signup.</summary>
    public string?   UtmSource          { get; private set; }

    /// <summary><c>trial</c> or <c>buy</c> — the intent declared on the pricing page.</summary>
    public string?   SignupIntent       { get; private set; }

    /// <summary>Billing period chosen on the pricing page, pre-selected at checkout.</summary>
    public BillingPeriod? SignupBillingPeriod { get; private set; }

    /// <summary>
    /// Which trial-reminder threshold (15/7/3/1) was last emailed. Makes the daily
    /// lifecycle job idempotent — re-running it the same day must not re-send.
    /// </summary>
    public int?      LastTrialReminderDaysLeft { get; private set; }

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
        ["visa_services"]= "visa",
    };

    /// <summary>The Industry-Pack module code for a given industry, or null.</summary>
    public static string? PackModuleFor(string? industry) =>
        industry is not null && IndustryPackModule.TryGetValue(industry, out var m) ? m : null;

    /// <summary>
    /// Resolved module list — what this tenant may actually access.
    /// <para>
    /// <see cref="EnabledModules"/> (the modules picked during onboarding) narrows the set, but the
    /// <b>plan is the ceiling</b>: the selection is intersected with <see cref="PlanLimits.Modules"/>,
    /// so a Micro tenant cannot hold POS just because it was ticked at signup. Changing tier is the
    /// only way to widen entitlement.
    /// </para>
    /// <para>
    /// The active Industry-Pack module (and <c>crm</c>, which packs build on) are folded in afterwards
    /// on <b>every</b> tier — packs are sold by industry, not by tier, and stripping one would break a
    /// live vertical tenant.
    /// </para>
    /// </summary>
    public IReadOnlyList<string> ResolvedModules
    {
        get
        {
            var entitled = Limits.Modules;

            var list = EnabledModules is not null
                ? System.Text.Json.JsonSerializer.Deserialize<List<string>>(EnabledModules)!
                    .Where(m => entitled.Contains(m, StringComparer.OrdinalIgnoreCase))
                    .ToList()
                : entitled.ToList();

            var pack = PackModuleFor(Industry);
            if (pack is not null)
            {
                if (!list.Contains("crm"))  list.Add("crm");
                if (!list.Contains(pack))   list.Add(pack);
            }
            return list;
        }
    }

    /// <summary>
    /// True while the tenant may use the product. Expired/Suspended tenants keep every row of their
    /// data — access is gated, never deleted — and flip back to <see cref="TenantStatus.Active"/>
    /// the moment a subscription is paid.
    /// </summary>
    public bool HasProductAccess =>
        Status is TenantStatus.Active or TenantStatus.Trial;

    /// <summary>Days left in the trial (negative once elapsed); null when not on a trial.</summary>
    public int? TrialDaysRemaining =>
        Status == TenantStatus.Trial && TrialEndsAt.HasValue
            ? (int)Math.Ceiling((TrialEndsAt.Value - DateTime.UtcNow).TotalDays)
            : null;

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
        string?        industry     = null,
        Guid?          id           = null)
    {
        var t = new Tenant(id ?? Guid.NewGuid(), name, slug.ToLowerInvariant(), plan, deploymentType, contactEmail, country);
        t.Industry = industry;
        return t;
    }

    /// <summary>Set or change the tenant's industry (activates the matching Industry Pack).</summary>
    public void SetIndustry(string? industry)
    {
        Industry  = industry;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Set the tenant's operating currency. Accepts a 3-letter code or a "USD - US Dollar" label
    /// (the leading token is taken). Null/blank leaves it unset (USD default applies downstream).
    /// </summary>
    public void SetCurrency(string? currency)
    {
        var code = currency?.Trim();
        if (!string.IsNullOrEmpty(code))
        {
            // Accept either "USD" or "USD - US Dollar" → take the first token, upper-cased.
            var token = code.Split([' ', '-'], StringSplitOptions.RemoveEmptyEntries).FirstOrDefault();
            code = token?.ToUpperInvariant();
        }
        Currency  = string.IsNullOrEmpty(code) ? null : code;
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

    /// <summary>
    /// Record where this signup came from (pricing-page query string). Purely informational —
    /// the plan itself is set through <see cref="Create"/>/<see cref="ChangePlan"/>.
    /// </summary>
    public void SetSignupAttribution(string? intent, BillingPeriod? billingPeriod, string? utmSource)
    {
        SignupIntent        = string.IsNullOrWhiteSpace(intent)    ? null : intent.Trim().ToLowerInvariant();
        SignupBillingPeriod = billingPeriod;
        UtmSource           = string.IsNullOrWhiteSpace(utmSource) ? null : utmSource.Trim();
        UpdatedAt           = DateTime.UtcNow;
    }

    /// <summary>Remember the reminder threshold just emailed, so the daily job never double-sends.</summary>
    public void MarkTrialReminderSent(int daysLeft)
    {
        LastTrialReminderDaysLeft = daysLeft;
        UpdatedAt                 = DateTime.UtcNow;
    }

    /// <summary>
    /// Restore access after a successful payment on an expired/suspended tenant, moving it onto the
    /// paid tier. Clears trial bookkeeping — the tenant is a customer now, not a trialist.
    /// </summary>
    public void ActivatePaid(PlanType plan, DateTime? paidUntil)
    {
        Plan                      = plan;
        Status                    = TenantStatus.Active;
        LicenseExpiresAt          = paidUntil;
        TrialEndsAt               = null;
        LastTrialReminderDaysLeft = null;
        UpdatedAt                 = DateTime.UtcNow;
    }
}
