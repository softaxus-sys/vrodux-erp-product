using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Softaxis.BuildingBlocks.Infrastructure.Seeding;

/// <summary>
/// Single switch for demo / sample business data seeding. <b>Off by default</b> — real
/// tenants, trial signups, staging and production must never receive demo data. Enable it
/// only for local development via config <c>Seeding:DemoData=true</c> (env
/// <c>Seeding__DemoData=true</c>).
///
/// This gates the legacy global demo seeds (which run with no tenant context and land as
/// <c>TenantId = NULL</c>). It is intentionally independent of the dedicated demo-<i>tenant</i>
/// provisioning (see <c>Seeding:DemoTenant</c>), which seeds data scoped to a real demo tenant.
/// </summary>
public static class DemoSeedGate
{
    public static bool DemoEnabled(IServiceProvider serviceProvider)
    {
        var cfg = serviceProvider.GetService<IConfiguration>();
        return bool.TryParse(cfg?["Seeding:DemoData"], out var enabled) && enabled;
    }
}
