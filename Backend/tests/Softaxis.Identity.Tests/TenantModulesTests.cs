using Softaxis.Identity.Domain.Entities;
using Softaxis.Identity.Domain.Enums;

namespace Softaxis.Identity.Tests;

public class TenantModulesTests
{
    private static Tenant NewTenant(string? industry, params string[] picked)
    {
        var t = Tenant.Create("Acme", "acme", PlanType.Micro, DeploymentType.Cloud, industry: industry);
        if (picked.Length > 0) t.SetEnabledModules(picked);
        return t;
    }

    [Theory]
    [InlineData(null, new[] { "pos" })]
    [InlineData("Real Estate", new[] { "real-estate", "crm" })]
    [InlineData("Import & Export", new[] { "trade" })]
    [InlineData("Other", new[] { "hr" })]
    public void Every_workspace_gets_seo_and_lead_generation(string? industry, string[] picked)
    {
        var modules = NewTenant(industry, picked).ResolvedModules;

        Assert.Contains("seo", modules);
        Assert.Contains("leadgen", modules);
    }

    [Fact]
    public void A_workspace_that_never_chose_modules_also_gets_them()
    {
        var modules = NewTenant(null).ResolvedModules;

        Assert.Contains("seo", modules);
        Assert.Contains("leadgen", modules);
    }

    [Fact]
    public void Picking_the_online_store_brings_inventory_along()
    {
        var modules = NewTenant(null, "ecommerce").ResolvedModules;

        Assert.Contains("ecommerce", modules);
        Assert.Contains("inventory", modules);
    }
}
