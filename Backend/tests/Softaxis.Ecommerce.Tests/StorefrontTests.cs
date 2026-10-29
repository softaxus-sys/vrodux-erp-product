using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;
using Softaxis.Ecommerce.Infrastructure.Services.Shop;
using Xunit;

namespace Softaxis.Ecommerce.Tests;

public class MoneyTests
{
    [Theory]
    [InlineData(12.5, "USD", 1250)]
    [InlineData(0.005, "USD", 1)]          // half-cents round away from zero, as the provider will
    [InlineData(1000, "JPY", 1000)]        // no minor unit
    [InlineData(1.234, "KWD", 1230)]       // three decimals, and Stripe wants multiples of ten
    public void ToMinor_uses_the_currencys_own_minor_unit(double amount, string currency, long expected) =>
        Assert.Equal(expected, Money.ToMinor((decimal)amount, currency));

    [Fact]
    public void ToText_has_the_decimals_PayPal_expects()
    {
        Assert.Equal("12.50", Money.ToText(12.5m, "USD"));
        Assert.Equal("1000", Money.ToText(1000m, "JPY"));
    }
}

public class StripeSignatureTests
{
    private const string Secret = "whsec_test";
    private static string Sign(string payload, long ts) =>
        Convert.ToHexString(HMACSHA256.HashData(Encoding.UTF8.GetBytes(Secret), Encoding.UTF8.GetBytes($"{ts}.{payload}"))).ToLowerInvariant();

    [Fact]
    public void A_correct_signature_near_now_is_accepted()
    {
        var now = DateTimeOffset.UtcNow; var ts = now.ToUnixTimeSeconds();
        Assert.True(StripeGateway.VerifySignature("{}", $"t={ts},v1={Sign("{}", ts)}", Secret, now));
    }

    [Fact]
    public void A_tampered_body_wrong_secret_or_old_timestamp_is_refused()
    {
        var now = DateTimeOffset.UtcNow; var ts = now.ToUnixTimeSeconds();
        var header = $"t={ts},v1={Sign("{}", ts)}";
        Assert.False(StripeGateway.VerifySignature("{ }", header, Secret, now));
        Assert.False(StripeGateway.VerifySignature("{}", header, "whsec_other", now));
        Assert.False(StripeGateway.VerifySignature("{}", $"t={ts - 3600},v1={Sign("{}", ts - 3600)}", Secret, now));
        Assert.False(StripeGateway.VerifySignature("{}", "", Secret, now));
        Assert.False(StripeGateway.VerifySignature("{}", header, "", now));
    }
}

public class ShopSecurityTests
{
    private static ShopSecurity Make() => new(new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Jwt:Secret"] = "unit-test-secret-0123456789" }).Build());

    [Fact]
    public void Passwords_verify_and_are_salted()
    {
        var s = Make();
        var a = s.HashPassword("correct horse"); var b = s.HashPassword("correct horse");
        Assert.NotEqual(a, b);
        Assert.True(s.VerifyPassword("correct horse", a));
        Assert.False(s.VerifyPassword("wrong", a));
        Assert.False(s.VerifyPassword("x", "garbage"));
    }

    [Fact]
    public void A_session_round_trips_and_ends_when_the_password_changes()
    {
        var s = Make(); var tenant = Guid.NewGuid(); var customer = Guid.NewGuid();
        var hash = s.HashPassword("one");
        var (token, _) = s.CreateSession(tenant, customer, hash);
        var read = s.ReadSession(token);
        Assert.NotNull(read);
        Assert.Equal(tenant, read!.TenantId); Assert.Equal(customer, read.CustomerId);
        Assert.True(s.StampMatches(read, hash));
        Assert.False(s.StampMatches(read, s.HashPassword("two")));
    }

    [Fact]
    public void A_tampered_or_foreign_token_is_refused()
    {
        var s = Make(); var (token, _) = s.CreateSession(Guid.NewGuid(), Guid.NewGuid(), s.HashPassword("x"));
        Assert.Null(s.ReadSession(token[..^2] + "00"));
        Assert.Null(s.ReadSession(null)); Assert.Null(s.ReadSession("a.b.c"));
        var other = new ShopSecurity(new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Jwt:Secret"] = "another-secret-0123456789" }).Build());
        Assert.Null(other.ReadSession(token));
    }
}

public class ReservedSlugTests
{
    [Theory] [InlineData("admin")] [InlineData("API")] [InlineData("www")]
    public void Platform_names_cannot_be_a_store_address(string slug) => Assert.True(ReservedSlugs.IsReserved(slug));

    [Fact] public void An_ordinary_name_is_allowed() => Assert.False(ReservedSlugs.IsReserved("my-shop"));
}
