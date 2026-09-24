using Microsoft.EntityFrameworkCore;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Infrastructure.Persistence.Repositories;

public sealed class PaymentMethodConfigRepository(POSDbContext db)
    : IPaymentMethodConfigRepository
{
    public Task<List<PaymentMethodConfig>> GetAllAsync(CancellationToken ct = default)
        => db.PaymentMethodConfigs
             .OrderBy(m => m.SortOrder)
             .ThenBy(m => m.Code)
             .ToListAsync(ct);

    public Task<PaymentMethodConfig?> GetByCodeAsync(string code, CancellationToken ct = default)
        => db.PaymentMethodConfigs
             .FirstOrDefaultAsync(m => m.Code == code, ct);

    public Task<PaymentMethodConfig?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => db.PaymentMethodConfigs
             .FindAsync([id], ct)
             .AsTask();

    /// <summary>
    /// Lazy per-tenant seed, same shape as the visa-type catalogue.
    ///
    /// <para>
    /// The registry is seeded through EF <c>HasData</c>, which cannot populate the shadow
    /// TenantId - so those rows land with TenantId NULL and the tenant filter (TenantId ==
    /// ambient) hides every one of them. The result was a Master Data screen and a POS Payment
    /// Methods screen that were simply empty, with no way to enable or disable anything, while
    /// the till quietly fell back to a hardcoded list in the frontend.
    /// </para>
    ///
    /// <para>
    /// Cloning the NULL-tenant rows rather than restating the catalogue in code keeps one
    /// definition of what a payment method is; the seed data stays where it already lives.
    /// </para>
    /// </summary>
    public async Task<bool> EnsureSeededForTenantAsync(string? country, CancellationToken ct = default)
    {
        // The filtered DbSet: this asks whether THIS tenant has any of its own.
        if (await db.PaymentMethodConfigs.AnyAsync(ct)) return false;

        var template = await db.PaymentMethodConfigs
            .IgnoreQueryFilters()
            .Where(m => EF.Property<Guid?>(m, "TenantId") == null)
            .AsNoTracking()
            .ToListAsync(ct);

        if (template.Count == 0) return false;

        var code = CountryCode(country);

        foreach (var t in template)
        {
            // Cash and Card ship enabled; the rest ship off. Enabling the ones that match the
            // tenant's country preserves exactly what the till already shows - the frontend
            // fallback enables country matches, so seeding them off would have REMOVED
            // EasyPaisa and JazzCash from a Pakistani till the moment this fix shipped.
            var enabled = t.IsEnabled || MatchesCountry(t.Countries, code);

            var created = PaymentMethodConfig.CreateSystem(
                t.Code, t.Label, t.IconKey, t.Countries, t.Description, t.SortOrder, enabled);

            if (created.IsSuccess) db.PaymentMethodConfigs.Add(created.Value);
        }

        // TenantId is stamped on save from the ambient tenant, which is resolved inside a request.
        await db.SaveChangesAsync(ct);
        return true;
    }

    /// <summary>"Pakistan" / "PK" / "pk" -> "pk". Empty when we cannot tell.</summary>
    private static string? CountryCode(string? country)
    {
        var c = country?.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(c)) return null;
        if (c.Length == 2) return c;
        return c switch
        {
            "pakistan"                      => "pk",
            "united arab emirates" or "uae" => "ae",
            "saudi arabia" or "ksa"         => "sa",
            "oman"                          => "om",
            "qatar"                         => "qa",
            "kuwait"                        => "kw",
            "bahrain"                       => "bh",
            "india"                         => "in",
            "united kingdom" or "uk"        => "gb",
            "united states" or "usa"        => "us",
            _                               => null,
        };
    }

    /// <summary>"*" is universal; otherwise a comma-separated list of ISO codes.</summary>
    private static bool MatchesCountry(string countries, string? code)
    {
        if (string.IsNullOrEmpty(code)) return false;
        if (countries == "*") return false;   // universal ones already carry their own IsEnabled
        return countries.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                        .Any(c => string.Equals(c, code, StringComparison.OrdinalIgnoreCase));
    }

    public void Add(PaymentMethodConfig method)
        => db.PaymentMethodConfigs.Add(method);
}
