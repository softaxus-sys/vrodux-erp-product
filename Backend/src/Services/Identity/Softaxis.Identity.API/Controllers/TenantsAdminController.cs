using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Application.DTOs;
using Softaxis.Identity.Domain.Entities;
using Softaxis.Identity.Domain.Enums;
using Softaxis.Identity.Domain.Repositories;
using Softaxis.Identity.API.Models;

namespace Softaxis.Identity.API.Controllers;

/// <summary>
/// Super-admin only. Manage tenants, plans, licenses.
/// All endpoints require the "SuperAdminOnly" policy (is_super_admin = true claim).
/// </summary>
[ApiController]
[Route("api/admin/tenants")]
[Produces("application/json")]
[Authorize(Policy = "SuperAdminOnly")]
public sealed class TenantsAdminController(
    ITenantRepository tenantRepo,
    IUserRepository   userRepo,
    IRoleRepository   roleRepo,
    IPasswordHasher   passwordHasher,
    ILicenseService   licenseService,
    IUnitOfWork       uow) : ControllerBase
{
    // GET /api/admin/tenants
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var tenants = await tenantRepo.GetAllAsync(ct);
        var dtos    = tenants.Select(MapToDto).ToList();
        return Ok(ApiResponse<List<TenantDto>>.Ok(dtos));
    }

    // GET /api/admin/tenants/{id}
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var tenant = await tenantRepo.GetByIdAsync(id, ct);
        if (tenant is null)
            return NotFound(ApiResponse<TenantDto>.Fail("Tenant.NotFound", "Tenant not found."));

        return Ok(ApiResponse<TenantDto>.Ok(MapToDto(tenant)));
    }

    // POST /api/admin/tenants
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateTenantRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Name) || string.IsNullOrWhiteSpace(req.Slug))
            return BadRequest(ApiResponse<TenantDto>.Fail("Tenant.Invalid", "Name and slug are required."));

        if (!Enum.TryParse<PlanType>(req.Plan, ignoreCase: true, out var plan))
            return BadRequest(ApiResponse<TenantDto>.Fail("Tenant.InvalidPlan", $"Unknown plan: {req.Plan}"));

        if (!Enum.TryParse<DeploymentType>(req.DeploymentType, ignoreCase: true, out var deployment))
            return BadRequest(ApiResponse<TenantDto>.Fail("Tenant.InvalidDeployment", $"Unknown deployment type: {req.DeploymentType}"));

        if (await tenantRepo.SlugExistsAsync(req.Slug, ct))
            return Conflict(ApiResponse<TenantDto>.Fail("Tenant.Slug.Taken", "A tenant with this slug already exists."));

        var tenant = Tenant.Create(req.Name, req.Slug, plan, deployment, req.ContactEmail, req.Country, req.Industry);

        if (req.StartTrial)
            tenant.StartTrial(30);
        else
            tenant.Activate();

        tenantRepo.Add(tenant);

        // ── Optionally provision the tenant's first admin user ───────────────────
        var wantAdmin = !string.IsNullOrWhiteSpace(req.AdminEmail) ||
                        !string.IsNullOrWhiteSpace(req.AdminPassword);
        if (wantAdmin)
        {
            if (string.IsNullOrWhiteSpace(req.AdminEmail) ||
                string.IsNullOrWhiteSpace(req.AdminPassword) ||
                string.IsNullOrWhiteSpace(req.AdminUsername))
                return BadRequest(ApiResponse<TenantDto>.Fail(
                    "Tenant.Admin.Invalid",
                    "Admin email, username and password are required to create the tenant admin user."));

            if (await userRepo.EmailExistsAsync(req.AdminEmail, ct))
                return Conflict(ApiResponse<TenantDto>.Fail("User.Email.Taken", "Admin email is already registered."));

            if (await userRepo.UsernameExistsAsync(req.AdminUsername, ct))
                return Conflict(ApiResponse<TenantDto>.Fail("User.Username.Taken", "Admin username is already taken."));

            var userResult = Softaxis.Identity.Domain.Entities.User.Create(
                req.AdminEmail,
                req.AdminUsername,
                string.IsNullOrWhiteSpace(req.AdminFirstName) ? "Tenant" : req.AdminFirstName!,
                string.IsNullOrWhiteSpace(req.AdminLastName)  ? "Admin"  : req.AdminLastName!,
                passwordHasher.Hash(req.AdminPassword));

            if (userResult.IsFailure)
                return BadRequest(ApiResponse<TenantDto>.Fail(userResult.Error.Code, userResult.Error.Description));

            var adminUser = userResult.Value;
            adminUser.VerifyEmail();          // pre-verified
            adminUser.SetTenant(tenant.Id);   // bind to the new tenant

            var adminRole = await roleRepo.GetByNameAsync("Administrator", ct);
            if (adminRole is not null) adminUser.AssignRole(adminRole.Id);

            userRepo.Add(adminUser);
        }

        await uow.SaveChangesAsync(ct);

        return StatusCode(201, ApiResponse<TenantDto>.Ok(MapToDto(tenant)));
    }

    // PUT /api/admin/tenants/{id}
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateTenantRequest req, CancellationToken ct)
    {
        var tenant = await tenantRepo.GetByIdAsync(id, ct);
        if (tenant is null)
            return NotFound(ApiResponse<TenantDto>.Fail("Tenant.NotFound", "Tenant not found."));

        tenant.UpdateProfile(req.Name, req.ContactEmail, req.ContactPhone, req.Country, req.PrimaryColor);
        tenantRepo.Update(tenant);
        await uow.SaveChangesAsync(ct);

        return Ok(ApiResponse<TenantDto>.Ok(MapToDto(tenant)));
    }

    // PATCH /api/admin/tenants/{id}/plan
    [HttpPatch("{id:guid}/plan")]
    public async Task<IActionResult> ChangePlan(Guid id, [FromBody] ChangePlanRequest req, CancellationToken ct)
    {
        if (!Enum.TryParse<PlanType>(req.Plan, ignoreCase: true, out var plan))
            return BadRequest(ApiResponse<TenantDto>.Fail("Tenant.InvalidPlan", $"Unknown plan: {req.Plan}"));

        var tenant = await tenantRepo.GetByIdAsync(id, ct);
        if (tenant is null)
            return NotFound(ApiResponse<TenantDto>.Fail("Tenant.NotFound", "Tenant not found."));

        tenant.ChangePlan(plan);
        tenantRepo.Update(tenant);
        await uow.SaveChangesAsync(ct);

        return Ok(ApiResponse<TenantDto>.Ok(MapToDto(tenant)));
    }

    // PATCH /api/admin/tenants/{id}/activate
    [HttpPatch("{id:guid}/activate")]
    public async Task<IActionResult> Activate(Guid id, CancellationToken ct)
    {
        var tenant = await tenantRepo.GetByIdAsync(id, ct);
        if (tenant is null)
            return NotFound(ApiResponse<TenantDto>.Fail("Tenant.NotFound", "Tenant not found."));

        tenant.Activate();
        tenantRepo.Update(tenant);
        await uow.SaveChangesAsync(ct);

        return Ok(ApiResponse<TenantDto>.Ok(MapToDto(tenant)));
    }

    // PATCH /api/admin/tenants/{id}/suspend
    [HttpPatch("{id:guid}/suspend")]
    public async Task<IActionResult> Suspend(Guid id, CancellationToken ct)
    {
        var tenant = await tenantRepo.GetByIdAsync(id, ct);
        if (tenant is null)
            return NotFound(ApiResponse<TenantDto>.Fail("Tenant.NotFound", "Tenant not found."));

        tenant.Suspend();
        tenantRepo.Update(tenant);
        await uow.SaveChangesAsync(ct);

        return Ok(ApiResponse<TenantDto>.Ok(MapToDto(tenant)));
    }

    // POST /api/admin/tenants/{id}/license
    [HttpPost("{id:guid}/license")]
    public async Task<IActionResult> GenerateLicense(
        Guid id, [FromBody] GenerateLicenseRequest req, CancellationToken ct)
    {
        var tenant = await tenantRepo.GetByIdAsync(id, ct);
        if (tenant is null)
            return NotFound(ApiResponse<GenerateLicenseResponse>.Fail("Tenant.NotFound", "Tenant not found."));

        if (tenant.DeploymentType != DeploymentType.OnPremises)
            return BadRequest(ApiResponse<GenerateLicenseResponse>.Fail(
                "Tenant.NotOnPrem", "License keys are only for on-premises deployments."));

        var expiresAt = DateTime.UtcNow.AddDays(req.ValidityDays);
        var limits    = tenant.Limits;

        var payload = new LicensePayload(
            TenantId:   tenant.Id,
            TenantSlug: tenant.Slug,
            Plan:       tenant.Plan.ToString(),
            MaxUsers:   limits.MaxUsers,
            Features:   req.Features,
            IssuedAt:   DateTime.UtcNow,
            ExpiresAt:  expiresAt);

        var key = licenseService.GenerateLicenseKey(payload);
        tenant.SetLicenseKey(key, expiresAt);
        tenantRepo.Update(tenant);
        await uow.SaveChangesAsync(ct);

        var response = new GenerateLicenseResponse(key, expiresAt);
        return Ok(ApiResponse<GenerateLicenseResponse>.Ok(response));
    }

    // PATCH /api/admin/tenants/{id}/subscription  — cloud tenants: set expiry + activate
    [HttpPatch("{id:guid}/subscription")]
    public async Task<IActionResult> RenewSubscription(
        Guid id, [FromBody] RenewSubscriptionRequest req, CancellationToken ct)
    {
        var tenant = await tenantRepo.GetByIdAsync(id, ct);
        if (tenant is null)
            return NotFound(ApiResponse<TenantDto>.Fail("Tenant.NotFound", "Tenant not found."));

        if (req.ExpiresAt.ToUniversalTime() <= DateTime.UtcNow)
            return BadRequest(ApiResponse<TenantDto>.Fail("Tenant.InvalidExpiry", "Expiry date must be in the future."));

        tenant.RenewSubscription(req.ExpiresAt.ToUniversalTime());
        tenantRepo.Update(tenant);
        await uow.SaveChangesAsync(ct);

        return Ok(ApiResponse<TenantDto>.Ok(MapToDto(tenant)));
    }

    // PATCH /api/admin/tenants/{id}/expire  — manually expire a tenant (cloud or on-prem)
    [HttpPatch("{id:guid}/expire")]
    public async Task<IActionResult> Expire(Guid id, CancellationToken ct)
    {
        var tenant = await tenantRepo.GetByIdAsync(id, ct);
        if (tenant is null)
            return NotFound(ApiResponse<TenantDto>.Fail("Tenant.NotFound", "Tenant not found."));

        tenant.Expire();
        tenantRepo.Update(tenant);
        await uow.SaveChangesAsync(ct);

        return Ok(ApiResponse<TenantDto>.Ok(MapToDto(tenant)));
    }

    // PUT /api/admin/tenants/{id}/connection-strings
    [HttpPut("{id:guid}/connection-strings")]
    public async Task<IActionResult> SetConnectionStrings(
        Guid id, [FromBody] SetConnectionStringsRequest req, CancellationToken ct)
    {
        var tenant = await tenantRepo.GetByIdAsync(id, ct);
        if (tenant is null)
            return NotFound(ApiResponse<TenantDto>.Fail("Tenant.NotFound", "Tenant not found."));

        // Store as JSON — in production, encrypt this before persisting
        var json = System.Text.Json.JsonSerializer.Serialize(new
        {
            IdentityDb   = req.IdentityDb,
            PosDb        = req.PosDb,
            InventoryDb  = req.InventoryDb,
        });

        tenant.SetConnectionStrings(json);
        tenantRepo.Update(tenant);
        await uow.SaveChangesAsync(ct);

        return Ok(ApiResponse<TenantDto>.Ok(MapToDto(tenant)));
    }

    // GET /api/admin/tenants/{id}/users/count
    [HttpGet("{id:guid}/users/count")]
    public async Task<IActionResult> GetUserCount(Guid id, CancellationToken ct)
    {
        var tenant = await tenantRepo.GetByIdAsync(id, ct);
        if (tenant is null)
            return NotFound(ApiResponse<object>.Fail("Tenant.NotFound", "Tenant not found."));

        var count  = await userRepo.CountByTenantAsync(id, ct);
        var limits = tenant.Limits;

        return Ok(ApiResponse<object>.Ok(new
        {
            TenantId  = id,
            Count     = count,
            MaxUsers  = limits.MaxUsers,
            Remaining = limits.MaxUsers < 0 ? -1 : Math.Max(0, limits.MaxUsers - count),
            AtLimit   = limits.MaxUsers >= 0 && count >= limits.MaxUsers,
        }));
    }

    // PATCH /api/admin/tenants/{id}/modules
    // Pass { "modules": null } to reset to plan defaults.
    [HttpPatch("{id:guid}/modules")]
    public async Task<IActionResult> SetModules(
        Guid id, [FromBody] SetModulesRequest req, CancellationToken ct)
    {
        var tenant = await tenantRepo.GetByIdAsync(id, ct);
        if (tenant is null)
            return NotFound(ApiResponse<TenantDto>.Fail("Tenant.NotFound", "Tenant not found."));

        if (req.Modules is not null)
        {
            var invalid = req.Modules
                .Where(m => string.IsNullOrWhiteSpace(m))
                .ToList();
            if (invalid.Count > 0)
                return BadRequest(ApiResponse<TenantDto>.Fail(
                    "Tenant.InvalidModules", "Module codes must be non-empty strings."));
        }

        tenant.SetEnabledModules(req.Modules);
        tenantRepo.Update(tenant);
        await uow.SaveChangesAsync(ct);

        return Ok(ApiResponse<TenantDto>.Ok(MapToDto(tenant)));
    }

    // PATCH /api/admin/tenants/{id}/industry
    // Set or change the tenant's industry (activates the matching Industry Pack).
    [HttpPatch("{id:guid}/industry")]
    public async Task<IActionResult> SetIndustry(
        Guid id, [FromBody] SetIndustryRequest req, CancellationToken ct)
    {
        var tenant = await tenantRepo.GetByIdAsync(id, ct);
        if (tenant is null)
            return NotFound(ApiResponse<TenantDto>.Fail("Tenant.NotFound", "Tenant not found."));

        tenant.SetIndustry(string.IsNullOrWhiteSpace(req.Industry) ? null : req.Industry.Trim());
        tenantRepo.Update(tenant);
        await uow.SaveChangesAsync(ct);

        return Ok(ApiResponse<TenantDto>.Ok(MapToDto(tenant)));
    }

    // DELETE /api/admin/tenants/{id}
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var tenant = await tenantRepo.GetByIdAsync(id, ct);
        if (tenant is null)
            return NotFound(ApiResponse<object>.Fail("Tenant.NotFound", "Tenant not found."));

        tenantRepo.Remove(tenant);
        await uow.SaveChangesAsync(ct);

        return Ok(ApiResponse.Ok());
    }

    // ── Mapping ───────────────────────────────────────────────────────────────

    private static TenantDto MapToDto(Tenant t) => new(
        Id:               t.Id,
        Name:             t.Name,
        Slug:             t.Slug,
        Plan:             t.Plan.ToString(),
        DeploymentType:   t.DeploymentType.ToString(),
        Status:           t.Status.ToString(),
        ContactEmail:     t.ContactEmail,
        ContactPhone:     t.ContactPhone,
        Country:          t.Country,
        PrimaryColor:     t.PrimaryColor,
        Industry:         t.Industry,
        HasLicenseKey:    t.LicenseKey is not null,
        LicenseExpiresAt: t.LicenseExpiresAt,
        LastHeartbeatAt:  t.LastHeartbeatAt,
        TrialEndsAt:      t.TrialEndsAt,
        MaxUsers:         t.Limits.MaxUsers,
        MaxWarehouses:    t.Limits.MaxWarehouses,
        ResolvedModules:  t.ResolvedModules,
        CreatedAt:        t.CreatedAt);
}
