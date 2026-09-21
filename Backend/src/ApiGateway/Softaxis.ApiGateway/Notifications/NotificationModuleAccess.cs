using Softaxis.BuildingBlocks.Application.Notifications;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Domain.Entities;

namespace Softaxis.ApiGateway.Notifications;

/// <summary>
/// Decides whether a reader may still see an alert, from the module that raised it.
///
/// <para>Alerts outlive entitlement. A tenant that drops the Visa module, or a user moved off CRM,
/// would otherwise keep a bell full of alerts linking into screens that now 403 — every click a dead
/// end. Filtering the feed by the SAME module list the gateway already enforces on routes keeps the
/// two from disagreeing.</para>
///
/// <para>Rows are kept, not deleted: entitlement comes back (a plan upgrade, a re-added module) and
/// the history should come back with it. Hiding is reversible; deleting is not.</para>
/// </summary>
public static class NotificationModuleAccess
{
    /// <summary>
    /// Notification module key → the licence code the gateway enforces. Most match one-for-one; the
    /// exceptions are real and deliberate: Purchase's licence code is "purchasing", and Restaurant is
    /// part of the POS licence rather than a module of its own.
    /// </summary>
    private static readonly IReadOnlyDictionary<string, string> Required =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            [NotificationModules.Crm]               = ModuleCodes.Crm,
            [NotificationModules.Hr]                = ModuleCodes.Hr,
            [NotificationModules.Finance]           = ModuleCodes.Finance,
            [NotificationModules.Purchase]          = ModuleCodes.Purchasing,
            [NotificationModules.Sales]             = ModuleCodes.Sales,
            [NotificationModules.Inventory]         = ModuleCodes.Inventory,
            [NotificationModules.ProjectManagement] = ModuleCodes.ProjectManagement,
            [NotificationModules.RealEstate]        = ModuleCodes.RealEstate,
            [NotificationModules.Visa]              = ModuleCodes.Visa,
            [NotificationModules.Pos]               = ModuleCodes.Pos,
            [NotificationModules.Restaurant]        = ModuleCodes.Pos,
            // Support and System are deliberately absent — an account-level or support alert is never
            // module-gated. Anything unmapped falls through to visible for the same reason: a new
            // module's alerts must not silently vanish because this table was not updated.
        };

    public static bool CanSee(ITenantContext tenant, string module)
    {
        if (tenant.IsSuperAdmin) return true;
        if (!Required.TryGetValue(module, out var code)) return true;
        return ModuleCodes.HasAccess(tenant.Modules, code);
    }

    /// <summary>
    /// Every module key that IS gated. A feed query needs this as well as the allowed set, so it can
    /// say "keep anything ungated, plus the gated ones you hold" in a single translatable predicate.
    /// </summary>
    public static readonly string[] GatedModules = Required.Keys.ToArray();

    /// <summary>The module keys this reader may see, for pushing straight into a SQL filter.</summary>
    public static string[] VisibleModules(ITenantContext tenant) =>
        tenant.IsSuperAdmin
            ? []
            : Required.Where(kv => ModuleCodes.HasAccess(tenant.Modules, kv.Value))
                      .Select(kv => kv.Key).ToArray();
}
