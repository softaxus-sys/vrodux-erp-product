using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Softaxis.Seo.Infrastructure.Persistence;

namespace Softaxis.Seo.Infrastructure.Profile;

/// <summary>What the workspace itself told us about its company (Settings → General, and the details given at signup).</summary>
public sealed record TenantBusinessDetails(string? Name, string? Industry, string? Country, string? Website, string? CompanySize, string? Address);

public interface ITenantBusinessReader
{
    Task<TenantBusinessDetails?> GetAsync(Guid tenantId, CancellationToken ct);
}

/// <summary>Reads Identity's tables (same database, other schema) so nobody types the company details twice. Never throws.</summary>
internal sealed class TenantBusinessReader(SeoDbContext db) : ITenantBusinessReader
{
    private sealed class SettingRow { public string SettingKey { get; set; } = ""; public string? Value { get; set; } }
    private sealed class TenantRow { public string Name { get; set; } = ""; public string? Country { get; set; } public string? Industry { get; set; } }

    public async Task<TenantBusinessDetails?> GetAsync(Guid tenantId, CancellationToken ct)
    {
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

            return new TenantBusinessDetails(
                Name: Get("legalName", "name") ?? tenant?.Name,
                Industry: Get("industry") ?? tenant?.Industry,
                Country: Get("country") ?? tenant?.Country,
                Website: Get("website"),
                CompanySize: Get("companySize"),
                Address: Get("address"));
        }
        catch { return null; }   // a settings-read failure must never break the SEO screens
    }
}

public sealed record TenantProposal(
    bool Enough, IReadOnlyList<string> Missing, IReadOnlyList<string> NotInWorkspace,
    string Name, string Industry, string Summary, string ServiceAreas);

/// <summary>Works out what the workspace's company details can and cannot fill in. Pure, so the "is there enough?" rule is exact and tested.</summary>
public static class TenantProfileMapper
{
    public static TenantProposal Propose(TenantBusinessDetails? d)
    {
        var name = d?.Name?.Trim() ?? "";
        var industry = HumaniseIndustry(d?.Industry);
        var country = ResolveCountry(d?.Country);

        var missing = new List<string>();
        if (name.Length == 0) missing.Add("business name");
        if (industry.Length == 0) missing.Add("industry");

        // A workspace records who the company is, not what it sells to whom — be upfront rather than invent it.
        var notThere = new List<string> { "what you sell", "who your customers are" };

        var summary = missing.Count > 0 ? "" :
            $"{name} operates in the {industry.ToLowerInvariant()} industry" + (country.Length > 0 ? $", based in {country}." : ".");

        return new TenantProposal(missing.Count == 0, missing, notThere, name, industry, summary, country);
    }

    /// <summary>"fitness_gym" → "Fitness gym".</summary>
    public static string HumaniseIndustry(string? raw)
    {
        var t = (raw ?? "").Replace('_', ' ').Replace('-', ' ').Trim();
        if (t.Length == 0) return "";
        t = string.Join(' ', t.Split(' ', StringSplitOptions.RemoveEmptyEntries));
        return char.ToUpperInvariant(t[0]) + t[1..];
    }

    public static string ResolveCountry(string? raw)
    {
        var t = (raw ?? "").Trim();
        if (t.Length == 2)
        {
            try { return new RegionInfo(t.ToUpperInvariant()).EnglishName; } catch { /* not a country code — use as typed */ }
        }
        return t;
    }

    /// <summary>True/false when both sides are known, null when the workspace has no website on file.</summary>
    public static bool? WebsiteMatches(string? tenantWebsite, string siteDomain)
    {
        var a = Host(tenantWebsite); var b = Host(siteDomain);
        if (a.Length == 0 || b.Length == 0) return null;
        return a == b || a.EndsWith("." + b, StringComparison.Ordinal) || b.EndsWith("." + a, StringComparison.Ordinal);
    }

    public static string Host(string? url)
    {
        var d = (url ?? "").Trim().ToLowerInvariant();
        if (d.StartsWith("https://", StringComparison.Ordinal)) d = d[8..];
        else if (d.StartsWith("http://", StringComparison.Ordinal)) d = d[7..];
        var slash = d.IndexOfAny(['/', '?', '#']);
        if (slash >= 0) d = d[..slash];
        return d.StartsWith("www.", StringComparison.Ordinal) ? d[4..] : d;
    }
}
