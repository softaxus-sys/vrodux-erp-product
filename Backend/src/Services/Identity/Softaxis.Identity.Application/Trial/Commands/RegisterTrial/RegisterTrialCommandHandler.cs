using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Application.Trial.Dtos;
using Softaxis.Identity.Domain.Entities;
using Softaxis.Identity.Domain.Enums;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.Trial.Commands.RegisterTrial;

public sealed class RegisterTrialCommandHandler(
    ITrialChallengeService challengeService,
    ITenantRepository      tenantRepo,
    IUserRepository        userRepo,
    ITenantRoleProvisioner roleProvisioner,
    IAuditLogRepository    auditRepo,
    IPasswordHasher        passwordHasher,
    IUnitOfWork            uow,
    ILogger<RegisterTrialCommandHandler> logger)
    : ICommandHandler<RegisterTrialCommand, TrialRegistrationResultDto>
{
    public async Task<Result<TrialRegistrationResultDto>> Handle(RegisterTrialCommand cmd, CancellationToken ct)
    {
        // ── 1. Verify challenge token ─────────────────────────────────────────

        if (!challengeService.Consume(cmd.ChallengeToken))
        {
            logger.LogWarning(
                "Trial registration rejected — invalid/missing challenge token. IP={IP}", cmd.RemoteIp);
            return Result.Failure<TrialRegistrationResultDto>(Error.Custom(
                "Trial.Unauthorized",
                "Missing or invalid challenge token. Call GET /api/trial/challenge first."));
        }

        // ── 2. Uniqueness checks ──────────────────────────────────────────────

        if (await userRepo.EmailExistsAsync(cmd.Email.Trim().ToLowerInvariant(), ct))
            return Result.Failure<TrialRegistrationResultDto>(
                Error.Custom("User.Email.Taken", "This email is already registered."));

        var username = GenerateUsername(cmd.Email);
        if (await userRepo.UsernameExistsAsync(username, ct))
            username = $"{username}_{Guid.NewGuid().ToString("N")[..6]}";

        var slug = GenerateSlug(cmd.OrgName);
        if (await tenantRepo.SlugExistsAsync(slug, ct))
            slug = $"{slug}-{Guid.NewGuid().ToString("N")[..5]}";

        // ── 3. Create tenant ──────────────────────────────────────────────────

        // Tier requested by the pricing-page link (?plan=micro|starter|professional).
        // Enterprise is sales-led and can never be self-provisioned, so it falls back to the
        // entry tier; unknown/absent values do the same. The trial period itself is tracked via
        // TenantStatus.Trial + TrialEndsAt regardless of tier.
        var requestedPlan = ResolveSignupPlan(cmd.Plan);
        var billingPeriod = ResolveBillingPeriod(cmd.Billing);

        var tenant = Tenant.Create(
            name:           cmd.OrgName.Trim(),
            slug:           slug,
            plan:           requestedPlan,
            deploymentType: DeploymentType.Cloud,
            contactEmail:   cmd.Email.Trim().ToLowerInvariant(),
            country:        cmd.Country,
            industry:       NormaliseIndustry(cmd.Industry));

        tenant.StartTrial(30);
        tenant.SetCurrency(cmd.Currency);   // browser-detected 3-letter code (USD default when null)
        tenant.SetSignupAttribution(cmd.Intent, billingPeriod, cmd.UtmSource);

        if (cmd.Modules is { Count: > 0 })
            tenant.SetEnabledModules(cmd.Modules);

        tenantRepo.Add(tenant);

        // ── 4. Create admin user ──────────────────────────────────────────────

        var nameParts = cmd.FullName?.Trim().Split(' ', 2, StringSplitOptions.RemoveEmptyEntries) ?? [];
        var (firstName, lastName) = nameParts.Length > 0
            ? (nameParts[0], nameParts.Length > 1 ? nameParts[1] : string.Empty)
            // No name supplied (frontend requires it, but guard the API) — derive from email
            // instead of the "Tenant"/"Admin" placeholder so the UI never shows "Tenant Admin".
            : Common.AdminNameFallback.Resolve(null, null, cmd.Email.Trim().ToLowerInvariant());

        var userResult = User.Create(
            cmd.Email.Trim().ToLowerInvariant(),
            username,
            firstName,
            lastName,
            passwordHasher.Hash(cmd.Password));

        if (userResult.IsFailure)
            return Result.Failure<TrialRegistrationResultDto>(userResult.Error);

        var user = userResult.Value;
        user.VerifyEmail();       // trial accounts are pre-verified
        user.SetTenant(tenant.Id);

        // Provision this tenant's own role set (Administrator + per-module Managers) and
        // make the trial user its Administrator.
        var adminRole = await roleProvisioner.ProvisionAsync(tenant.Id, tenant.ResolvedModules, ct);
        user.AssignRole(adminRole.Id);

        userRepo.Add(user);

        auditRepo.Add(new AuditLog(
            user.Id, "TRIAL_REGISTER", "Tenant", tenant.Id.ToString(),
            null, null, null, null, true, tenant.Id));

        await uow.SaveChangesAsync(ct);

        logger.LogInformation(
            "Trial tenant created. TenantId={TenantId} Slug={Slug} Email={Email} Modules=[{Modules}]",
            tenant.Id, tenant.Slug, cmd.Email,
            cmd.Modules is not null ? string.Join(',', cmd.Modules) : "default");

        return Result.Success(new TrialRegistrationResultDto(
            TenantId:          tenant.Id,
            TenantSlug:        tenant.Slug,
            UserId:            user.Id,
            Email:             user.Email.Value,
            TrialEndsAt:       tenant.TrialEndsAt,
            Plan:              tenant.Plan.ToString(),
            // "Buy Now" → the UI routes to checkout after login. Activation still requires a
            // provider webhook; nothing here marks the tenant paid.
            CheckoutRequested: string.Equals(cmd.Intent, "buy", StringComparison.OrdinalIgnoreCase),
            BillingPeriod:     billingPeriod.ToString()));
    }

    /// <summary>
    /// Map the pricing-page <c>?plan=</c> slug to a tier. Enterprise is deliberately NOT
    /// self-serviceable — its price is negotiated, so a crafted URL must not provision it.
    /// Anything unknown falls back to the entry tier rather than failing the signup.
    /// </summary>
    private static PlanType ResolveSignupPlan(string? plan)
    {
        if (string.IsNullOrWhiteSpace(plan)) return PlanType.Micro;

        return plan.Trim().ToLowerInvariant() switch
        {
            "micro"        => PlanType.Micro,
            "starter"      => PlanType.Starter,
            "professional" => PlanType.Professional,
            _              => PlanType.Micro,
        };
    }

    private static BillingPeriod ResolveBillingPeriod(string? billing) =>
        string.Equals(billing?.Trim(), "monthly", StringComparison.OrdinalIgnoreCase)
            ? BillingPeriod.Monthly
            : BillingPeriod.Annual;   // pricing page defaults every CTA to annual

    private static string GenerateSlug(string orgName) =>
        System.Text.RegularExpressions.Regex.Replace(
            orgName.ToLowerInvariant().Trim(), @"[^a-z0-9]+", "-").Trim('-');

    private static string GenerateUsername(string email) =>
        System.Text.RegularExpressions.Regex.Replace(
            email.Split('@')[0].ToLowerInvariant(), @"[^a-z0-9_.\-]", "_");

    private static string? NormaliseIndustry(string? industry) =>
        string.IsNullOrWhiteSpace(industry) || industry is "Other" or "All Industries"
            ? null
            : industry.ToLowerInvariant()
                      .Replace(" & ", "_").Replace(" ", "_").Replace("/", "_");
}
