using System.Collections.Concurrent;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Ecommerce.Domain.Entities;
using Softaxis.Ecommerce.Infrastructure.Persistence;

namespace Softaxis.Ecommerce.Infrastructure.Services.Shop;

internal static class ShopErrors
{
    // One answer for a wrong address, an unpublished store and a suspended workspace: which shops exist is not for a stranger to learn.
    public static readonly Error NoShop = Error.Custom("Shop.NotFound", "This store is not available.");
    public static readonly Error NoProduct = Error.Custom("Product.NotFound", "That product is not available.");
    public static readonly Error NoOrder = Error.Custom("Order.NotFound", "We could not find that order.");
    public static readonly Error SignInAgain = Error.Custom("Account.Unauthorized", "Please sign in again.");
    public static readonly Error BadLogin = Error.Custom("Account.Unauthorized", "That email and password do not match.");

    public static Error Invalid(string message) => Error.Custom("Validation.Failed", message);
    public static Error Conflict(string message) => Error.Custom("Order.Conflict", message);
}

internal static class ShopJson
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);

    public static List<string> Strings(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try { return JsonSerializer.Deserialize<List<string>>(json, Options) ?? []; } catch (JsonException) { return []; }
    }

    public static List<Guid> Guids(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try { return JsonSerializer.Deserialize<List<Guid>>(json, Options) ?? []; } catch (JsonException) { return []; }
    }

    public static string Write<T>(T value) => JsonSerializer.Serialize(value, Options);

    /// <summary>True when the text is a JSON value of the expected broad shape ("object" / "array") — used to keep junk out of the settings columns.</summary>
    public static bool IsJson(string? json, JsonValueKind kind)
    {
        if (string.IsNullOrWhiteSpace(json)) return false;
        try { using var d = JsonDocument.Parse(json); return d.RootElement.ValueKind == kind; } catch (JsonException) { return false; }
    }
}

internal static class Money
{
    private static readonly HashSet<string> ZeroDecimal = new(StringComparer.OrdinalIgnoreCase)
        { "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF" };
    private static readonly HashSet<string> ThreeDecimal = new(StringComparer.OrdinalIgnoreCase)
        { "BHD", "IQD", "JOD", "KWD", "LYD", "OMR", "TND" };

    public static int Decimals(string currency) => ZeroDecimal.Contains(currency) ? 0 : ThreeDecimal.Contains(currency) ? 3 : 2;

    public static decimal Round(decimal amount, string currency) => Math.Round(amount, Decimals(currency), MidpointRounding.AwayFromZero);

    /// <summary>The smallest-unit amount payment providers want (cents, fils…). Stripe wants three-decimal currencies in multiples of ten.</summary>
    public static long ToMinor(decimal amount, string currency)
    {
        var minor = (long)Math.Round(amount * (decimal)Math.Pow(10, Decimals(currency)), MidpointRounding.AwayFromZero);
        return Decimals(currency) == 3 ? (long)(Math.Round(minor / 10m, MidpointRounding.AwayFromZero) * 10) : minor;
    }

    /// <summary>The decimal text PayPal wants ("12.50", "1000" for yen).</summary>
    public static string ToText(decimal amount, string currency) =>
        Round(amount, currency).ToString("F" + Decimals(currency), CultureInfo.InvariantCulture);
}

/// <summary>Reserved for the platform's own use; a store cannot take them as its address.</summary>
internal static class ReservedSlugs
{
    private static readonly HashSet<string> Names = new(StringComparer.OrdinalIgnoreCase)
    {
        "www", "api", "admin", "app", "erp", "shop", "store", "stores", "mail", "smtp", "ftp", "static", "assets", "cdn",
        "login", "auth", "billing", "support", "help", "status", "docs", "blog", "dashboard", "vrodux", "softaxis", "demo", "test",
    };
    public static bool IsReserved(string slug) => Names.Contains(slug);
}

/// <summary>
/// Password hashing and the shopper session token. Shoppers are not Identity users: a store can have thousands, they must
/// not consume plan seats, and nothing they hold opens the ERP. The session is its own signed token whose key is derived
/// from the JWT secret under a label of its own, so it cannot be used as (or mistaken for) a staff access token.
/// </summary>
internal interface IShopSecurity
{
    string HashPassword(string password);
    bool VerifyPassword(string password, string hash);
    (string Token, DateTime ExpiresAt) CreateSession(Guid tenantId, Guid customerId, string passwordHash);
    ShopSession? ReadSession(string? token);
    bool StampMatches(ShopSession s, string passwordHash);
    string NewResetToken();
    string HashResetToken(string token);
}

internal sealed record ShopSession(Guid TenantId, Guid CustomerId, string Stamp);

internal sealed class ShopSecurity : IShopSecurity
{
    private const int Iterations = 100_000;
    private static readonly TimeSpan Lifetime = TimeSpan.FromDays(14);
    private readonly byte[] _key;

    public ShopSecurity(IConfiguration configuration)
    {
        var secret = configuration["Jwt:Secret"] ?? configuration["Jwt:Key"]
            ?? throw new InvalidOperationException("Jwt:Secret is not configured.");
        _key = SHA256.HashData(Encoding.UTF8.GetBytes("vrodux::store-customer::" + secret));
    }

    public string HashPassword(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(16);
        var hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, Iterations, HashAlgorithmName.SHA256, 32);
        return $"v1.{Convert.ToBase64String(salt)}.{Convert.ToBase64String(hash)}";
    }

    public bool VerifyPassword(string password, string hash)
    {
        var parts = hash.Split('.');
        if (parts.Length != 3 || parts[0] != "v1") return false;
        try
        {
            var salt = Convert.FromBase64String(parts[1]);
            var expected = Convert.FromBase64String(parts[2]);
            var actual = Rfc2898DeriveBytes.Pbkdf2(password, salt, Iterations, HashAlgorithmName.SHA256, expected.Length);
            return CryptographicOperations.FixedTimeEquals(actual, expected);
        }
        catch (FormatException) { return false; }
    }

    /// <summary>Changes whenever the password does, so a new password ends every open session.</summary>
    private static string Stamp(string passwordHash) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(passwordHash)))[..16];

    public (string Token, DateTime ExpiresAt) CreateSession(Guid tenantId, Guid customerId, string passwordHash)
    {
        var expires = DateTime.UtcNow.Add(Lifetime);
        var payload = string.Create(CultureInfo.InvariantCulture,
            $"{tenantId:N}.{customerId:N}.{new DateTimeOffset(expires).ToUnixTimeSeconds()}.{Stamp(passwordHash)}");
        return ($"{payload}.{Sign(payload)}", expires);
    }

    public ShopSession? ReadSession(string? token)
    {
        if (string.IsNullOrWhiteSpace(token) || token.Length > 300) return null;
        var cut = token.LastIndexOf('.');
        if (cut <= 0) return null;

        var payload = token[..cut];
        var given = Encoding.ASCII.GetBytes(token[(cut + 1)..]);
        var wanted = Encoding.ASCII.GetBytes(Sign(payload));
        if (!CryptographicOperations.FixedTimeEquals(given, wanted)) return null;

        var parts = payload.Split('.');
        if (parts.Length != 4
            || !Guid.TryParseExact(parts[0], "N", out var tenantId)
            || !Guid.TryParseExact(parts[1], "N", out var customerId)
            || !long.TryParse(parts[2], NumberStyles.None, CultureInfo.InvariantCulture, out var exp)
            || DateTimeOffset.FromUnixTimeSeconds(exp) < DateTimeOffset.UtcNow)
            return null;

        return new ShopSession(tenantId, customerId, parts[3]);
    }

    public bool StampMatches(ShopSession s, string passwordHash) => s.Stamp == Stamp(passwordHash);

    public string NewResetToken() => Convert.ToHexString(RandomNumberGenerator.GetBytes(24)).ToLowerInvariant();
    public string HashResetToken(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

    private string Sign(string payload) => Convert.ToHexString(HMACSHA256.HashData(_key, Encoding.UTF8.GetBytes(payload)));
}

/// <summary>A shop whose store is switched on, in a workspace that is in good standing.</summary>
internal sealed record ShopDoor(Store Store, TenantLookup Tenant)
{
    /// <summary>
    /// Makes every Ecommerce query that follows belong to this workspace. An anonymous request has no tenant, and with
    /// none the query filter lets every workspace's rows through — so a handler must call this before it touches a
    /// store table. Deliberately a plain method, not folded into <see cref="ShopGate.OpenAsync"/>: an ambient value set
    /// inside an awaited method is gone again when that method returns to its caller.
    /// </summary>
    public void Enter() => TenantAmbient.Set(Tenant.Id, isSuperAdmin: false, isResolved: true, Store.CurrencyCode);
}

internal sealed class ShopGate(EcommerceDbContext db, Softaxis.Ecommerce.Application.Abstractions.IShopPreview preview)
{
    /// <param name="requirePublished">Customers see only a published store. The owner's own staff may preview it before it opens.</param>
    public async Task<Result<ShopDoor>> OpenAsync(string? slug, CancellationToken ct, bool requirePublished = true)
    {
        var key = (slug ?? string.Empty).Trim().ToLowerInvariant();
        if (key.Length is 0 or > 63) return Result.Failure<ShopDoor>(ShopErrors.NoShop);

        // No ambient tenant yet, so read the store past the filter and take its tenant from the row.
        var row = await db.Stores.IgnoreQueryFilters().AsNoTracking()
            .Where(s => s.Slug == key)
            .Select(s => new { Store = s, TenantId = EF.Property<Guid?>(s, "TenantId") })
            .FirstOrDefaultAsync(ct);
        if (row?.TenantId is null) return Result.Failure<ShopDoor>(ShopErrors.NoShop);
        if (requirePublished && !row.Store.IsPublished && !preview.CanPreview(row.TenantId.Value)) return Result.Failure<ShopDoor>(ShopErrors.NoShop);

        var tenant = await db.TenantLookups.AsNoTracking().FirstOrDefaultAsync(t => t.Id == row.TenantId.Value && !t.IsDeleted, ct);
        if (tenant is null || tenant.Status is "Suspended" or "Expired") return Result.Failure<ShopDoor>(ShopErrors.NoShop);

        return Result.Success(new ShopDoor(row.Store, tenant));
    }
}

/// <summary>
/// Serialises "is it in stock, then take it" per product. Two shoppers buying the last unit must not both succeed:
/// Inventory will happily let a sale push stock below zero, so the check-and-take pair has to be one step. One
/// gateway process serves a deployment, which is what makes an in-process lock enough.
/// </summary>
internal static class StockGuard
{
    private static readonly ConcurrentDictionary<Guid, SemaphoreSlim> Locks = new();

    public static async Task<IDisposable> LockAsync(IEnumerable<Guid> productIds, CancellationToken ct)
    {
        // Always in id order, so two carts sharing products cannot lock them in opposite orders and deadlock.
        var held = new List<SemaphoreSlim>();
        try
        {
            foreach (var id in productIds.Distinct().OrderBy(x => x))
            {
                var gate = Locks.GetOrAdd(id, _ => new SemaphoreSlim(1, 1));
                await gate.WaitAsync(ct);
                held.Add(gate);
            }
        }
        catch { foreach (var g in held) g.Release(); throw; }
        return new Release(held);
    }

    private sealed class Release(List<SemaphoreSlim> held) : IDisposable
    {
        private bool _done;
        public void Dispose() { if (_done) return; _done = true; foreach (var g in held) g.Release(); }
    }
}
