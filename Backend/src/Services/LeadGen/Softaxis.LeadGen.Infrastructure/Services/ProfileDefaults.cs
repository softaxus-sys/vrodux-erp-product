using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.LeadGen.Application.Catalog;
using Softaxis.LeadGen.Application.Setup;
using Softaxis.LeadGen.Domain.Entities;
using Softaxis.LeadGen.Infrastructure.Persistence;

namespace Softaxis.LeadGen.Infrastructure.Services;

public sealed record CompanyDefaults(string? Name, string? Address, string? Website, string? CountryCode, string? Industry);

/// <summary>
/// What the workspace already told us when it was created or in Settings → General, so nobody types
/// the same business name, address and website twice. Read from Identity's tables (same database).
/// </summary>
public interface ICompanyDefaultsReader
{
    Task<CompanyDefaults?> GetAsync(Guid tenantId, CancellationToken ct);
}

internal sealed class CompanyDefaultsReader(LeadGenDbContext db, IMemoryCache cache) : ICompanyDefaultsReader
{
    private sealed class SettingRow { public string SettingKey { get; set; } = ""; public string? Value { get; set; } }
    private sealed class TenantRow { public string Name { get; set; } = ""; public string? Country { get; set; } public string? Industry { get; set; } }

    public async Task<CompanyDefaults?> GetAsync(Guid tenantId, CancellationToken ct)
    {
        var key = $"leadgen:company:{tenantId}";
        if (cache.TryGetValue(key, out CompanyDefaults? hit)) return hit;
        try
        {
            var settings = await db.Database.SqlQuery<SettingRow>($"""
                SELECT [Key] AS SettingKey, [Value] FROM [identity].[app_settings]
                WHERE [TenantId] = {tenantId} AND [Category] IN ('company', 'regional') AND [UserId] IS NULL
                """).ToListAsync(ct);
            var tenant = (await db.Database.SqlQuery<TenantRow>(
                $"SELECT [Name], [Country], [Industry] FROM [identity].[tenants] WHERE [Id] = {tenantId} AND [IsDeleted] = 0").ToListAsync(ct)).FirstOrDefault();

            var map = settings.Where(s => !string.IsNullOrWhiteSpace(s.Value))
                .GroupBy(s => s.SettingKey, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.First().Value!.Trim(), StringComparer.OrdinalIgnoreCase);
            string? Get(params string[] ks) { foreach (var k in ks) if (map.TryGetValue(k, out var v)) return v; return null; }

            var address = Get("address");
            var poBox = Get("poBox");
            if (address is not null && poBox is not null && !address.Contains(poBox, StringComparison.OrdinalIgnoreCase)) address += ", P.O. Box " + poBox;

            var info = new CompanyDefaults(
                Name: Get("legalName", "name") ?? tenant?.Name,
                Address: address,
                Website: Get("website"),
                CountryCode: ResolveCountry(Get("country") ?? tenant?.Country),
                Industry: Get("industry") ?? tenant?.Industry);
            cache.Set(key, info, TimeSpan.FromMinutes(5));
            return info;
        }
        catch { return null; }   // a settings-read failure must never break Lead Generation
    }

    private static string? ResolveCountry(string? v)
    {
        if (string.IsNullOrWhiteSpace(v)) return null;
        var c = GeoCatalog.Get(v.Trim()) ?? GeoCatalog.All.FirstOrDefault(x => string.Equals(x.Name, v.Trim(), StringComparison.OrdinalIgnoreCase));
        return c?.Code;
    }
}

/// <summary>Loads the workspace profile and, until the owner has saved it once, fills the blanks from what we already know.</summary>
public interface IProfileDefaults
{
    Task<LeadGenProfile> EnsureAsync(CancellationToken ct);
}

internal sealed class ProfileDefaults(LeadGenDbContext db, ICompanyDefaultsReader reader) : IProfileDefaults
{
    public async Task<LeadGenProfile> EnsureAsync(CancellationToken ct)
    {
        var p = await db.Profiles.FirstOrDefaultAsync(ct);
        if (p is null)
        {
            try { p = LeadGenProfile.CreateEmpty(); db.Profiles.Add(p); await db.SaveChangesAsync(ct); }
            catch (DbUpdateException) { db.ChangeTracker.Clear(); p = await db.Profiles.FirstAsync(ct); }
        }
        // Once the owner has saved the form the profile is theirs; never refill a field they cleared.
        if (p.UpdatedAt is not null || TenantAmbient.TenantId is not { } tenantId) return p;

        var c = await reader.GetAsync(tenantId, ct);
        if (c is null) return p;
        var live = c.CountryCode is { } code && GeoCatalog.Get(code) is { Live: true } ? code : null;
        var s = ProfileSuggestions.For(c.Industry);
        var cats = s?.Categories.Where(CategoryCatalog.IsValid).ToArray();

        if (p.ApplyDefaults(c.Name, c.Address, c.Website, live,
                s is null ? null : ProfileSuggestions.OfferFor(s, c.Name), s?.TargetCustomers,
                cats is { Length: > 0 } ? System.Text.Json.JsonSerializer.Serialize(cats) : null))
            await db.SaveChangesAsync(ct);
        return p;
    }
}
