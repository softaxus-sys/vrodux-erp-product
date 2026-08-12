namespace Softaxis.Identity.Domain.Enums;

/// <summary>
/// Public subscription tiers, matching vrodux.com/pricing.
/// </summary>
/// <remarks>
/// <para>
/// Persisted as a <b>string</b> (<c>TenantConfiguration</c> uses <c>HasConversion&lt;string&gt;()</c>),
/// so the numeric values are cosmetic but the <b>names are load-bearing</b> — renaming a member
/// silently re-interprets every existing row.
/// </para>
/// <para>
/// The legacy catalogue was <c>Starter</c>(3 users) / <c>Business</c>(15) / <c>Enterprise</c>.
/// Migration <c>RenameLegacyPlanNames</c> rewrites those rows to <c>Micro</c> / <c>Professional</c> /
/// <c>Enterprise</c> — mapped by matching seat limits, not by name, so no tenant loses capacity.
/// <c>Starter</c> now means the 10-seat tier and must only ever appear on rows written after that migration.
/// </para>
/// </remarks>
public enum PlanType
{
    /// <summary>$159/mo, $129/mo billed annually. Up to 3 users. Core ERP only.</summary>
    Micro = 1,

    /// <summary>$299/mo, $249/mo billed annually. Up to 10 users. Core ERP only.</summary>
    Starter = 2,

    /// <summary>$849/mo, $699/mo billed annually. Up to 50 users. Adds POS, Restaurant, Hospitality, multi-currency, API.</summary>
    Professional = 3,

    /// <summary>Custom pricing, sales-led. Unlimited users and modules.</summary>
    Enterprise = 4,
}
