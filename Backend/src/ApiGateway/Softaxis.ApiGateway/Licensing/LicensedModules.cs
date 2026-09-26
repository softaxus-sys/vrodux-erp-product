using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Softaxis.Identity.Application.Abstractions;

namespace Softaxis.ApiGateway.Licensing;

/// <summary>
/// The modules an installation is licensed to run, used to decide which schemas to create.
///
/// <para>
/// A cloud deployment hosts many tenants with different entitlements in one database, so it always
/// installs everything and gates per request. An on-premises box serves exactly one customer: a
/// shop licensed for POS, Inventory and Finance has no business acquiring a <c>visa</c>,
/// <c>hospitality</c> or <c>construction</c> schema. Beyond tidiness that is fewer tables to back
/// up, fewer migrations to run at every upgrade, and one less thing for a customer's DBA to ask
/// about.
/// </para>
///
/// <para>
/// The APIs are already licence-mapped at runtime by <c>ModuleEnforcementMiddleware</c>, which
/// refuses any route whose module the tenant does not hold. This is the database half of the same
/// idea, and it is deliberately the only half done here: physically unregistering controllers
/// would change what a shared cloud build serves, for no gain over a 403.
/// </para>
/// </summary>
public static class LicensedModules
{
    /// <summary>
    /// Infrastructure every installation needs whatever it bought. Identity holds the tenant and
    /// the users; notifications, support and the assistant are cross-cutting and carry no licence
    /// of their own.
    /// </summary>
    private static readonly string[] AlwaysInstalled =
        ["identity", "notifications", "support", "ai-assistant"];

    /// <summary>
    /// Modules that read another module's schema directly, in raw SQL, with no guard. Installing
    /// one without the other produces a box that starts cleanly and then fails at the till.
    ///
    /// <para>
    /// POS and Inventory are mutual: <c>CrossSchemaProductService</c> reads <c>[inventory].
    /// [products]</c> and <c>[inventory].[warehouses]</c>, while Inventory's
    /// <c>StockMovementRepository</c> writes back to <c>[pos].[products]</c>. Restaurant reads
    /// <c>[pos].[pos_sessions]</c> to post a sale against the open shift.
    /// </para>
    ///
    /// <para>
    /// Not listed, deliberately: Notifications' CRM history backfill and Inventory's category
    /// import both test <c>OBJECT_ID(...) IS NOT NULL</c> first, so they degrade quietly when the
    /// other schema is absent. Visa's links to Finance and CRM are made by the frontend calling
    /// their APIs, so they are entitlement questions, not schema ones.
    /// </para>
    /// </summary>
    private static readonly Dictionary<string, string[]> Requires =
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["pos"]        = ["inventory"],
            ["inventory"]  = ["pos"],
            ["restaurant"] = ["pos", "inventory"],
            ["recipe"]     = ["restaurant", "pos", "inventory"],
        };

    /// <summary>
    /// Resolves the set to install, or <see langword="null"/> meaning "everything".
    ///
    /// <para>
    /// Null is returned for any deployment with no licence key — every cloud environment, and a
    /// developer's machine. Those must keep installing the full schema, so this can never quietly
    /// shrink a cloud database.
    /// </para>
    /// </summary>
    public static HashSet<string>? Resolve(IServiceProvider services, IConfiguration cfg, ILogger logger)
    {
        var licence = cfg["OnPremises:LicenseKey"]?.Trim();
        if (string.IsNullOrWhiteSpace(licence))
            return null;

        using var scope = services.CreateScope();
        var payload = scope.ServiceProvider.GetRequiredService<ILicenseService>().ValidateForThisMachine(licence);

        // An unreadable or expired key is not a reason to install a partial database. The tenant is
        // blocked by SubscriptionEnforcementMiddleware either way, and installing everything leaves
        // the box ready the moment a valid key is pasted in.
        if (payload is null)
        {
            logger.LogWarning(
                "Licensing: the license key is invalid or expired, so every module's schema will be " +
                "installed. Activate a valid key to narrow it.");
            return null;
        }

        var wanted = new HashSet<string>(AlwaysInstalled, StringComparer.OrdinalIgnoreCase);

        foreach (var feature in payload.Features ?? [])
        {
            var code = feature?.Trim().ToLowerInvariant();
            if (string.IsNullOrEmpty(code)) continue;
            wanted.Add(code);
        }

        // Pull in whatever the licensed modules read from, transitively — Restaurant needs POS,
        // which needs Inventory. Iterating to a fixed point rather than one pass, so a chain
        // longer than two links cannot be missed.
        bool grew;
        do
        {
            grew = false;
            foreach (var code in wanted.ToArray())
                if (Requires.TryGetValue(code, out var deps))
                    foreach (var dep in deps)
                        if (wanted.Add(dep))
                        {
                            logger.LogInformation(
                                "Licensing: installing {Dep} because {Module} reads its tables directly.",
                                dep, code);
                            grew = true;
                        }
        } while (grew);

        logger.LogInformation(
            "Licensing: installing schemas for {Count} module(s) - {Modules}.",
            wanted.Count, string.Join(", ", wanted.OrderBy(m => m, StringComparer.Ordinal)));

        return wanted;
    }
}
