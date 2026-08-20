using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.Finance.Domain.Entities;

namespace Softaxis.Finance.Infrastructure.Persistence.Seed;

/// <summary>
/// Materialises the standard chart of accounts (and the five account types) <b>for a specific
/// tenant</b>.
///
/// <para><b>Why this exists.</b> <see cref="Account"/> and <see cref="AccountType"/> live in
/// <c>Softaxis.Finance.Domain</c>, so <c>TenantIsolation.ApplyTenantId</c> gives them a shadow
/// <c>TenantId</c> plus the global filter <c>TenantId == ambient</c>. The startup seed in
/// <see cref="FinanceSeedData"/> runs with <b>no ambient tenant</b> (there is no HTTP request),
/// and <c>StampTenantId</c> is a no-op unless <c>TenantAmbient.IsResolved</c> — so every seeded
/// account landed with <c>TenantId = NULL</c>. In SQL <c>NULL == guid</c> is <c>NULL</c> (false),
/// so the seeded chart of accounts was invisible to <b>every</b> tenant, and <c>GlPoster</c> threw
/// "GL account '1200' was not found" the first time an invoice was sent. Same class of bug as the
/// <c>ProjectMember</c> / <c>OrderPayment</c> NULL-tenant defects fixed previously.</para>
///
/// <para><b>Why not make the chart of accounts global instead.</b> Tenants create, rename and
/// deactivate their own accounts through <c>AccountsController</c>. Excluding <see cref="Account"/>
/// from tenant isolation (as <c>Currency</c>/<c>ExchangeRate</c> are) would expose and allow editing
/// of every tenant's ledger accounts across tenant boundaries. The chart of accounts is tenant-owned
/// business data, so each tenant gets its own copy.</para>
///
/// Idempotent and safe to re-run: it only inserts account numbers / type codes the tenant does not
/// already have, and never touches rows the tenant has since edited.
/// </summary>
internal static class ChartOfAccountsProvisioner
{
    /// <summary>
    /// Ensures <paramref name="tenantId"/> owns the standard account types and chart of accounts.
    /// Returns the number of accounts inserted. Does NOT call SaveChanges — the caller decides
    /// when to commit (so this can join an existing unit of work).
    /// </summary>
    public static async Task<int> EnsureForTenantAsync(
        FinanceDbContext db, Guid tenantId, CancellationToken ct = default)
    {
        // Query past the global filter and scope explicitly: at startup there is no ambient tenant,
        // and at request time the ambient tenant may not be the one being provisioned.
        var existingTypes = await db.AccountTypes.IgnoreQueryFilters()
            .Where(x => EF.Property<Guid?>(x, TenantIsolation.Column) == tenantId)
            .Select(x => new { x.Code, x.Id })
            .ToListAsync(ct);

        var typeIdByCode = existingTypes
            .GroupBy(x => x.Code, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First().Id, StringComparer.OrdinalIgnoreCase);

        foreach (var def in ChartOfAccountsCatalogue.AccountTypes)
        {
            if (typeIdByCode.ContainsKey(def.Code)) continue;
            var type = new AccountType(def.Code, def.Name, def.NormalBalance, def.SortOrder);
            db.AccountTypes.Add(type);
            Stamp(db, type, tenantId);
            typeIdByCode[def.Code] = type.Id;
        }

        var existingNumbers = await db.Accounts.IgnoreQueryFilters()
            .Where(x => EF.Property<Guid?>(x, TenantIsolation.Column) == tenantId)
            .Select(x => x.AccountNumber)
            .ToListAsync(ct);
        var numbers = new HashSet<string>(existingNumbers, StringComparer.OrdinalIgnoreCase);

        var inserted = 0;
        foreach (var def in ChartOfAccountsCatalogue.Accounts)
        {
            if (numbers.Contains(def.Number)) continue;

            // Opening balances stay at zero — the demo figures in FinanceSeedData are for the
            // dev/demo dataset only; a real tenant starts from an empty ledger.
            var account = new Account(def.Number, def.Name, def.TypeCode, null, null);
            if (typeIdByCode.TryGetValue(def.TypeCode, out var typeId))
                account.SetAccountTypeId(typeId);

            db.Accounts.Add(account);
            Stamp(db, account, tenantId);
            inserted++;
        }

        return inserted;
    }

    /// <summary>
    /// Sets the shadow TenantId explicitly. <c>StampTenantId</c> cannot be relied on here: it
    /// early-returns unless <c>TenantAmbient.IsResolved</c>, which is never true during startup
    /// seeding, and would stamp the *caller's* tenant rather than <paramref name="tenantId"/>.
    /// </summary>
    private static void Stamp<T>(FinanceDbContext db, T entity, Guid tenantId) where T : class
        => db.Entry(entity).Property(TenantIsolation.Column).CurrentValue = tenantId;
}
