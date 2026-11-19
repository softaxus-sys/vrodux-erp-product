using System.Collections.Concurrent;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;
using Microsoft.Extensions.Options;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Application.Common;
using Softaxis.Identity.Application.DTOs;
using Softaxis.Identity.Domain.Entities;
using Softaxis.Identity.Domain.Enums;
using Softaxis.Identity.Domain.Repositories;
using Softaxis.Identity.Infrastructure.Persistence;
using Softaxis.Identity.Infrastructure.Services;
using RefreshTokenEntity = Softaxis.Identity.Domain.Entities.RefreshToken;

namespace Softaxis.Identity.Infrastructure.Sso;

// ── Commands and queries ────────────────────────────────────────────────────

public sealed record MicrosoftStartDto(bool Enabled, string? Url);
/// <summary>Step 1: where should this person be sent to sign in? Anonymous.</summary>
public sealed record StartMicrosoftSignInQuery(string Email, string RedirectUri) : IQuery<MicrosoftStartDto>;

public sealed record MicrosoftCompleteDto(string? Code, string? Error);
/// <summary>Step 2: Microsoft has sent the browser back. Anonymous; the state ties it to step 1.</summary>
public sealed record CompleteMicrosoftSignInCommand(string? State, string? Code, string? Error, string? ErrorDescription) : ICommand<MicrosoftCompleteDto>;

/// <summary>Step 3: the browser swaps the one-time code for a Vrodux session.</summary>
public sealed record ExchangeMicrosoftCodeCommand(string Code, string? IpAddress) : ICommand<AuthTokenDto>;

public sealed record MicrosoftSignInDto(bool Enabled, string? DirectoryId, string? ClientId, bool HasSecret, string RedirectUri);
public sealed record GetMicrosoftSignInQuery(string RedirectUri) : IQuery<MicrosoftSignInDto>;
public sealed record SaveMicrosoftSignInCommand(bool Enabled, string? DirectoryId, string? ClientId, string? ClientSecret, string RedirectUri)
    : ICommand<MicrosoftSignInDto>;

// ── Short-lived memory: pending sign-ins and one-time codes ─────────────────

public sealed record PendingSso(Guid TenantId, Guid UserId, string Nonce, string Verifier, string RedirectUri);

/// <summary>
/// Holds the two short-lived secrets this flow needs: the PKCE verifier + nonce between the redirect out and
/// the redirect back, and the one-time code between our callback and the browser. Both are single use and
/// expire in minutes, so an in-memory cache is the right size for them (the gateway is one process).
/// </summary>
public sealed class SsoPendingStore(IMemoryCache cache)
{
    private static string Rand(int bytes = 32) => Convert.ToBase64String(RandomNumberGenerator.GetBytes(bytes)).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    public string Begin(PendingSso p) { var s = Rand(); cache.Set("sso:state:" + s, p, TimeSpan.FromMinutes(10)); return s; }
    public PendingSso? Take(string? state)
    {
        if (string.IsNullOrWhiteSpace(state) || !cache.TryGetValue("sso:state:" + state, out PendingSso? p) || p is null) return null;
        cache.Remove("sso:state:" + state);
        return p;
    }
    public string IssueCode(Guid userId) { var c = Rand(); cache.Set("sso:code:" + c, userId, TimeSpan.FromSeconds(90)); return c; }
    public Guid? RedeemCode(string? code)
    {
        if (string.IsNullOrWhiteSpace(code) || !cache.TryGetValue("sso:code:" + code, out Guid id)) return null;
        cache.Remove("sso:code:" + code);
        return id;
    }
    public static string NewNonce() => Rand(16);
    public static string NewVerifier() => Rand(32);
    public static string Challenge(string verifier) => Convert.ToBase64String(SHA256.HashData(Encoding.ASCII.GetBytes(verifier))).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}

/// <summary>Encrypts the client secret at rest (AES-256-GCM, key derived from the JWT secret, own label).</summary>
public sealed class SsoSecretProtector
{
    private readonly byte[] _key;
    public SsoSecretProtector(IOptions<JwtSettings> jwt) => _key = SHA256.HashData(Encoding.UTF8.GetBytes("vrodux::sso-client-secret::" + jwt.Value.Secret));

    public string Protect(string plain)
    {
        var nonce = RandomNumberGenerator.GetBytes(12); var data = Encoding.UTF8.GetBytes(plain);
        var cipher = new byte[data.Length]; var tag = new byte[16];
        using var aes = new AesGcm(_key, 16); aes.Encrypt(nonce, data, cipher, tag);
        return Convert.ToBase64String(nonce.Concat(tag).Concat(cipher).ToArray());
    }
    public string Unprotect(string text)
    {
        var all = Convert.FromBase64String(text);
        var plain = new byte[all.Length - 28];
        using var aes = new AesGcm(_key, 16); aes.Decrypt(all.AsSpan(0, 12), all.AsSpan(28), all.AsSpan(12, 16), plain);
        return Encoding.UTF8.GetString(plain);
    }
}

// ── The OpenID Connect conversation with Microsoft ──────────────────────────

public sealed record MicrosoftIdentity(string Email, string? Name, string ObjectId);

/// <summary>
/// Authorization-code flow with PKCE against the workspace's own Entra directory. The id token is validated
/// properly: signature from the directory's published keys, issuer, audience (our client id), lifetime, the
/// nonce we sent, and that it was issued by the directory we expected.
/// </summary>
public sealed class MicrosoftOidcClient(IHttpClientFactory http, IConfiguration config, ILogger<MicrosoftOidcClient> log)
{
    // Overridable so tests can point at a local stand-in; never set in production.
    private string LoginBase => (config["Microsoft:LoginBase"] ?? "https://login.microsoftonline.com").TrimEnd('/');
    private static readonly ConcurrentDictionary<string, ConfigurationManager<OpenIdConnectConfiguration>> Metadata = new();

    public string BuildAuthorizeUrl(string directoryId, string clientId, string redirectUri, string state, string nonce, string challenge, string? loginHint)
    {
        var q = new Dictionary<string, string>
        {
            ["client_id"] = clientId, ["response_type"] = "code", ["redirect_uri"] = redirectUri, ["response_mode"] = "query",
            ["scope"] = "openid profile email", ["state"] = state, ["nonce"] = nonce,
            ["code_challenge"] = challenge, ["code_challenge_method"] = "S256", ["prompt"] = "select_account",
        };
        if (!string.IsNullOrWhiteSpace(loginHint)) q["login_hint"] = loginHint;
        return $"{LoginBase}/{directoryId}/oauth2/v2.0/authorize?" + string.Join("&", q.Select(kv => $"{kv.Key}={Uri.EscapeDataString(kv.Value)}"));
    }

    private sealed class TokenResponse
    {
        [JsonPropertyName("id_token")] public string? IdToken { get; set; }
        [JsonPropertyName("error")] public string? Error { get; set; }
        [JsonPropertyName("error_description")] public string? ErrorDescription { get; set; }
    }

    public async Task<MicrosoftIdentity> RedeemAsync(string directoryId, string clientId, string clientSecret, string redirectUri, string code,
        string verifier, string expectedNonce, CancellationToken ct)
    {
        var client = http.CreateClient("microsoft-sso");
        client.Timeout = TimeSpan.FromSeconds(20);
        using var res = await client.PostAsync($"{LoginBase}/{directoryId}/oauth2/v2.0/token", new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["client_id"] = clientId, ["client_secret"] = clientSecret, ["grant_type"] = "authorization_code", ["code"] = code,
            ["redirect_uri"] = redirectUri, ["code_verifier"] = verifier, ["scope"] = "openid profile email",
        }), ct);
        var body = await res.Content.ReadFromJsonAsync<TokenResponse>(cancellationToken: ct);
        if (!res.IsSuccessStatusCode || string.IsNullOrEmpty(body?.IdToken))
        {
            log.LogWarning("Microsoft token exchange failed: {Status} {Error}", (int)res.StatusCode, body?.Error);
            throw new InvalidOperationException("Microsoft did not accept the sign-in. Ask your administrator to check the app's client secret and redirect address.");
        }

        var manager = Metadata.GetOrAdd($"{LoginBase}|{directoryId}", _ => new ConfigurationManager<OpenIdConnectConfiguration>(
            $"{LoginBase}/{directoryId}/v2.0/.well-known/openid-configuration", new OpenIdConnectConfigurationRetriever(), new HttpDocumentRetriever(client) { RequireHttps = !LoginBase.StartsWith("http://localhost") }));
        var oidc = await manager.GetConfigurationAsync(ct);

        var result = await new JsonWebTokenHandler().ValidateTokenAsync(body.IdToken, new TokenValidationParameters
        {
            ValidIssuer = oidc.Issuer, ValidAudience = clientId, IssuerSigningKeys = oidc.SigningKeys,
            ValidateIssuer = true, ValidateAudience = true, ValidateLifetime = true, ValidateIssuerSigningKey = true,
            ClockSkew = TimeSpan.FromMinutes(2), RequireSignedTokens = true,
            ValidAlgorithms = [SecurityAlgorithms.RsaSha256],
        });
        if (!result.IsValid) { log.LogWarning(result.Exception, "Microsoft id token rejected"); throw new InvalidOperationException("The Microsoft sign-in could not be verified."); }

        var jwt = (JsonWebToken)result.SecurityToken;
        string? Claim(string n) => jwt.TryGetClaim(n, out var c) ? c.Value : null;
        if (!string.Equals(Claim("nonce"), expectedNonce, StringComparison.Ordinal)) throw new InvalidOperationException("The Microsoft sign-in did not match the request that started it.");
        if (!string.Equals(Claim("tid"), directoryId, StringComparison.OrdinalIgnoreCase)) throw new InvalidOperationException("That sign-in came from a different Microsoft directory.");

        var email = (Claim("email") ?? Claim("preferred_username") ?? Claim("upn"))?.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(email) || !email.Contains('@')) throw new InvalidOperationException("Your Microsoft account did not share an email address.");
        return new MicrosoftIdentity(email, Claim("name"), Claim("oid") ?? Claim("sub") ?? email);
    }
}

// ── Handlers ────────────────────────────────────────────────────────────────

internal sealed class StartMicrosoftSignInHandler(IUserRepository users, IdentityDbContext db, SsoPendingStore store, MicrosoftOidcClient oidc, SsoSecretProtector secrets)
    : IQueryHandler<StartMicrosoftSignInQuery, MicrosoftStartDto>
{
    public async Task<Result<MicrosoftStartDto>> Handle(StartMicrosoftSignInQuery q, CancellationToken ct)
    {
        // Every "no" looks the same — unknown address, not a member of a workspace, or SSO not switched on —
        // so this endpoint can't be used to find out who has an account.
        var no = Result.Success(new MicrosoftStartDto(false, null));
        var email = q.Email?.Trim();
        if (string.IsNullOrEmpty(email) || !email.Contains('@')) return no;
        var user = await users.GetByEmailAsync(email, ct);
        if (user?.TenantId is not { } tenantId || user.IsSuperAdmin) return no;
        var s = await db.Set<TenantSsoSettings>().AsNoTracking().FirstOrDefaultAsync(x => x.TenantId == tenantId, ct);
        if (s is null || !s.IsUsable) return no;

        var nonce = SsoPendingStore.NewNonce(); var verifier = SsoPendingStore.NewVerifier();
        var state = store.Begin(new PendingSso(tenantId, user.Id, nonce, verifier, q.RedirectUri));
        _ = secrets; // secret is read at redemption, never at the start
        return Result.Success(new MicrosoftStartDto(true, oidc.BuildAuthorizeUrl(s.DirectoryId!, s.ClientId!, q.RedirectUri, state, nonce, SsoPendingStore.Challenge(verifier), email)));
    }
}

internal sealed class CompleteMicrosoftSignInHandler(IdentityDbContext db, IUserRepository users, SsoPendingStore store, MicrosoftOidcClient oidc, SsoSecretProtector secrets,
    IAuditLogRepository audit, IUnitOfWork uow, ILogger<CompleteMicrosoftSignInHandler> log) : ICommandHandler<CompleteMicrosoftSignInCommand, MicrosoftCompleteDto>
{
    public async Task<Result<MicrosoftCompleteDto>> Handle(CompleteMicrosoftSignInCommand c, CancellationToken ct)
    {
        MicrosoftCompleteDto Fail(string msg) => new(null, msg);
        var pending = store.Take(c.State);
        if (pending is null) return Result.Success(Fail("That sign-in link has expired. Please start again."));
        if (!string.IsNullOrEmpty(c.Error)) return Result.Success(Fail(c.Error == "access_denied" ? "The Microsoft sign-in was cancelled." : "Microsoft could not sign you in."));
        if (string.IsNullOrEmpty(c.Code)) return Result.Success(Fail("Microsoft did not return a sign-in code."));

        var s = await db.Set<TenantSsoSettings>().AsNoTracking().FirstOrDefaultAsync(x => x.TenantId == pending.TenantId, ct);
        if (s is null || !s.IsUsable) return Result.Success(Fail("Microsoft sign-in is no longer switched on for your organisation."));

        MicrosoftIdentity who;
        try
        {
            who = await oidc.RedeemAsync(s.DirectoryId!, s.ClientId!, secrets.Unprotect(s.ClientSecretCipher!), pending.RedirectUri, c.Code, pending.Verifier, pending.Nonce, ct);
        }
        catch (InvalidOperationException ex) { return Result.Success(Fail(ex.Message)); }
        catch (Exception ex) { log.LogWarning(ex, "Microsoft sign-in failed"); return Result.Success(Fail("Microsoft sign-in failed. Please try again.")); }

        // The account Microsoft vouched for must be the one the person asked to sign in as. Without this, anyone
        // in the directory could open another colleague's Vrodux account by starting the flow with their email.
        var user = await users.GetByIdAsync(pending.UserId, ct);
        if (user is null || user.TenantId != pending.TenantId || !string.Equals(user.Email.Value, who.Email, StringComparison.OrdinalIgnoreCase))
        {
            audit.Add(new AuditLog(user?.Id, "LOGIN_SSO_MISMATCH", "User", pending.UserId.ToString(), null, null, null, null, false, pending.TenantId));
            await uow.SaveChangesAsync(ct);
            return Result.Success(Fail("The Microsoft account doesn't match the Vrodux account you started with."));
        }
        return Result.Success(new MicrosoftCompleteDto(store.IssueCode(user.Id), null));
    }
}

internal sealed class ExchangeMicrosoftCodeHandler(SsoPendingStore store, IUserRepository users, ITenantRepository tenants, IPermissionRepository perms,
    IRefreshTokenRepository refresh, IJwtTokenService jwt, IAuditLogRepository audit, ITenantSecurityPolicyProvider policies, IUnitOfWork uow)
    : ICommandHandler<ExchangeMicrosoftCodeCommand, AuthTokenDto>
{
    private static Result<AuthTokenDto> Fail(string m) => Result.Failure<AuthTokenDto>(Error.Custom("Auth.Login.Failed", m));

    public async Task<Result<AuthTokenDto>> Handle(ExchangeMicrosoftCodeCommand c, CancellationToken ct)
    {
        if (store.RedeemCode(c.Code) is not { } userId) return Fail("That sign-in has expired. Please start again.");
        var user = await users.GetByIdAsync(userId, ct);
        if (user is null) return Fail("Account not found.");
        if (user.IsLocked) return Fail("Account is locked. Try again later.");
        if (user.Status == UserStatus.Inactive) return Fail("This account is switched off. Contact your administrator.");
        if (user.TenantId is null || user.IsSuperAdmin) return Fail("This account can't sign in with Microsoft.");

        var tenant = await tenants.GetByIdAsync(user.TenantId.Value, ct);
        if (tenant is null) return Fail("This workspace is no longer available. Please contact your administrator.");

        // Same network rule and session policy as a password sign-in. Microsoft proves who the person is;
        // it must not be a way round the workspace's own restrictions.
        var policy = await policies.GetAsync(user.TenantId, ct);
        if (!policy.AllowsIp(c.IpAddress)) return Fail("Sign-in from this network is not permitted. Contact your administrator.");

        // Microsoft has just proved control of this mailbox, so an account still waiting on email verification is verified.
        if (!user.EmailVerified) user.VerifyEmail();
        user.RecordLoginSuccess();
        if (policy.SingleSession) await refresh.RevokeAllForUserAsync(user.Id, ct);

        var permKeys = await perms.GetPermissionKeysForUserAsync(user.Id, ct);
        var raw = jwt.GenerateRefreshTokenRaw();
        refresh.Add(new RefreshTokenEntity(user.Id, jwt.HashToken(raw), jwt.RefreshTokenExpiry, c.IpAddress, null, "Microsoft 365", "web"));
        users.Update(user);
        audit.Add(new AuditLog(user.Id, "LOGIN_SSO", "User", user.Id.ToString(), null, null, c.IpAddress, null, true, user.TenantId));
        await uow.SaveChangesAsync(ct);

        return Result.Success(new AuthTokenDto(jwt.GenerateAccessToken(user, permKeys, tenant, sessionMinutes: policy.SessionTimeoutMinutes), raw,
            jwt.AccessTokenExpiryFor(policy.SessionTimeoutMinutes), UserDtoMapper.ToDto(user)));
    }
}

internal sealed class GetMicrosoftSignInHandler(IdentityDbContext db, ICurrentUser me) : IQueryHandler<GetMicrosoftSignInQuery, MicrosoftSignInDto>
{
    public async Task<Result<MicrosoftSignInDto>> Handle(GetMicrosoftSignInQuery q, CancellationToken ct)
    {
        if (me.TenantId is not { } t || !me.HasPermission("settings.users.edit")) return Result.Failure<MicrosoftSignInDto>(Error.Custom("Access.Forbidden", "Only a workspace administrator can see this."));
        var s = await db.Set<TenantSsoSettings>().AsNoTracking().FirstOrDefaultAsync(x => x.TenantId == t, ct);
        return Result.Success(new MicrosoftSignInDto(s?.Enabled ?? false, s?.DirectoryId, s?.ClientId, !string.IsNullOrEmpty(s?.ClientSecretCipher), q.RedirectUri));
    }
}

internal sealed class SaveMicrosoftSignInHandler(IdentityDbContext db, ICurrentUser me, SsoSecretProtector secrets, IAuditLogRepository audit, IUnitOfWork uow)
    : ICommandHandler<SaveMicrosoftSignInCommand, MicrosoftSignInDto>
{
    private static bool Guid32(string? s) => Guid.TryParse(s, out _);

    public async Task<Result<MicrosoftSignInDto>> Handle(SaveMicrosoftSignInCommand c, CancellationToken ct)
    {
        if (me.TenantId is not { } t || !me.HasPermission("settings.users.edit")) return Result.Failure<MicrosoftSignInDto>(Error.Custom("Access.Forbidden", "Only a workspace administrator can change this."));
        var s = await db.Set<TenantSsoSettings>().FirstOrDefaultAsync(x => x.TenantId == t, ct);
        var hasSecret = !string.IsNullOrEmpty(s?.ClientSecretCipher) || !string.IsNullOrWhiteSpace(c.ClientSecret);
        if (c.Enabled && (!Guid32(c.DirectoryId) || !Guid32(c.ClientId) || !hasSecret))
            return Result.Failure<MicrosoftSignInDto>(Error.Custom("Validation.Failed", "To switch Microsoft sign-in on, give the directory ID, the client ID and a client secret."));
        if (!string.IsNullOrWhiteSpace(c.DirectoryId) && !Guid32(c.DirectoryId) || !string.IsNullOrWhiteSpace(c.ClientId) && !Guid32(c.ClientId))
            return Result.Failure<MicrosoftSignInDto>(Error.Custom("Validation.Failed", "The directory ID and client ID are GUIDs, like 00000000-0000-0000-0000-000000000000."));

        if (s is null) { s = new TenantSsoSettings(t); db.Set<TenantSsoSettings>().Add(s); }
        s.Update(c.Enabled, c.DirectoryId, c.ClientId, string.IsNullOrWhiteSpace(c.ClientSecret) ? null : secrets.Protect(c.ClientSecret.Trim()), me.Email);
        audit.Add(new AuditLog(me.Id, "SSO_CONFIG_CHANGED", "Tenant", t.ToString(), null, c.Enabled ? "enabled" : "disabled", null, null, true, t));
        await uow.SaveChangesAsync(ct);
        return Result.Success(new MicrosoftSignInDto(s.Enabled, s.DirectoryId, s.ClientId, !string.IsNullOrEmpty(s.ClientSecretCipher), c.RedirectUri));
    }
}
