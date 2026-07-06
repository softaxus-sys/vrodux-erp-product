using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Softaxis.BuildingBlocks.Domain.Multitenancy;

namespace Softaxis.BuildingBlocks.Infrastructure.Seeding;

/// <summary>
/// Dedicated demo-<i>tenant</i> seeding switch. <b>Off by default</b> — enable only for a
/// dedicated demo / sales-pitch deployment via config <c>Seeding:DemoTenant=true</c>
/// (env <c>Seeding__DemoTenant=true</c>).
///
/// Unlike <see cref="DemoSeedGate"/> (which seeds legacy global data with <c>TenantId = NULL</c>),
/// this seeds every module's demo data <b>scoped to a single fixed demo tenant</b>
/// (<see cref="DemoTenantId"/>). Each service wraps its existing idempotent seeder in
/// <see cref="RunAsync"/>, which sets the ambient tenant so <c>StampTenantId</c> stamps every
/// inserted row with the demo tenant id and the query-filter guards scope to it.
///
/// Intended for a <b>fresh / dedicated demo database</b>: the seeders' idempotency guards use the
/// fixed entity GUIDs, so running against a database that already holds a real tenant's data is not
/// supported (and must never be done — never enable this on the production database).
/// </summary>
public static class DemoTenantSeeder
{
    /// <summary>
    /// Fixed tenant id for the "Vrodux Demo" tenant. Shared by the Identity provisioner (which
    /// creates the tenant/roles/users) and every business service (which stamps demo data with it).
    /// </summary>
    public static readonly Guid DemoTenantId = new("de300000-0000-0000-0000-000000000001");

    /// <summary>True when <c>Seeding:DemoTenant</c> is configured truthy.</summary>
    public static bool Enabled(IServiceProvider serviceProvider)
    {
        var cfg = serviceProvider.GetService<IConfiguration>();
        return bool.TryParse(cfg?["Seeding:DemoTenant"], out var enabled) && enabled;
    }

    /// <summary>
    /// Runs <paramref name="seed"/> with the demo tenant set as the ambient tenant, so every row
    /// it inserts is stamped with <see cref="DemoTenantId"/>. Always clears the ambient afterwards.
    /// </summary>
    public static async Task RunAsync(Func<Task> seed)
    {
        TenantAmbient.Set(DemoTenantId, isSuperAdmin: false, isResolved: true);
        try
        {
            await seed();
        }
        finally
        {
            TenantAmbient.Clear();
        }
    }
}
