using System.Security.Claims;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Identity.Application.DTOs;
using Softaxis.Identity.Application.TenantsAdmin.Commands.ActivateTenant;
using Softaxis.Identity.Application.TenantsAdmin.Commands.ImpersonateTenant;
using Softaxis.Identity.Application.TenantsAdmin.Commands.ChangeTenantPlan;
using Softaxis.Identity.Application.TenantsAdmin.Commands.CreateTenant;
using Softaxis.Identity.Application.TenantsAdmin.Commands.DeleteTenant;
using Softaxis.Identity.Application.TenantsAdmin.Commands.ExpireTenant;
using Softaxis.Identity.Application.TenantsAdmin.Commands.GenerateTenantLicense;
using Softaxis.Identity.Application.TenantsAdmin.Commands.RenewTenantSubscription;
using Softaxis.Identity.Application.TenantsAdmin.Commands.SetTenantConnectionStrings;
using Softaxis.Identity.Application.TenantsAdmin.Commands.SetTenantIndustry;
using Softaxis.Identity.Application.TenantsAdmin.Commands.SetTenantModules;
using Softaxis.Identity.Application.TenantsAdmin.Commands.SuspendTenant;
using Softaxis.Identity.Application.TenantsAdmin.Commands.UpdateTenant;
using Softaxis.Identity.Application.TenantsAdmin.Queries.GetTenantById;
using Softaxis.Identity.Application.TenantsAdmin.Queries.GetTenants;
using Softaxis.Identity.Application.TenantsAdmin.Queries.GetTenantUserCount;

namespace Softaxis.Identity.API.Controllers;

/// <summary>
/// Super-admin only. Manage tenants, plans, licenses.
/// All endpoints require the "SuperAdminOnly" policy (is_super_admin = true claim).
/// </summary>
[ApiController]
[Route("api/admin/tenants")]
[Produces("application/json")]
[Authorize(Policy = "SuperAdminOnly")]
public sealed class TenantsAdminController(ISender sender) : BaseApiController(sender)
{
    // GET /api/admin/tenants
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
        => HandleResult(await Sender.Send(new GetTenantsQuery(), ct));

    // GET /api/admin/tenants/{id}
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
        => HandleResult(await Sender.Send(new GetTenantByIdQuery(id), ct));

    // POST /api/admin/tenants
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateTenantRequest req, CancellationToken ct)
    {
        var result = await Sender.Send(new CreateTenantCommand(
            req.Name, req.Slug, req.Plan, req.DeploymentType, req.ContactEmail, req.Country, req.Industry, req.Currency,
            req.StartTrial, req.AdminEmail, req.AdminUsername, req.AdminFirstName, req.AdminLastName, req.AdminPassword), ct);
        return HandleResult(result, successCode: 201);
    }

    // PUT /api/admin/tenants/{id}
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateTenantRequest req, CancellationToken ct)
        => HandleResult(await Sender.Send(new UpdateTenantCommand(id, req.Name, req.ContactEmail, req.ContactPhone, req.Country, req.PrimaryColor), ct));

    // PATCH /api/admin/tenants/{id}/plan
    [HttpPatch("{id:guid}/plan")]
    public async Task<IActionResult> ChangePlan(Guid id, [FromBody] ChangePlanRequest req, CancellationToken ct)
        => HandleResult(await Sender.Send(new ChangeTenantPlanCommand(id, req.Plan), ct));

    // PATCH /api/admin/tenants/{id}/activate
    [HttpPatch("{id:guid}/activate")]
    public async Task<IActionResult> Activate(Guid id, CancellationToken ct)
        => HandleResult(await Sender.Send(new ActivateTenantCommand(id), ct));

    // PATCH /api/admin/tenants/{id}/suspend
    [HttpPatch("{id:guid}/suspend")]
    public async Task<IActionResult> Suspend(Guid id, CancellationToken ct)
        => HandleResult(await Sender.Send(new SuspendTenantCommand(id), ct));

    // POST /api/admin/tenants/{id}/impersonate
    // Issues a tenant-scoped token so the super-admin can view/operate the app AS this tenant.
    [HttpPost("{id:guid}/impersonate")]
    public async Task<IActionResult> Impersonate(Guid id, CancellationToken ct)
    {
        var superAdminId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (!Guid.TryParse(superAdminId, out var uid))
            return Unauthorized();
        return HandleResult(await Sender.Send(new ImpersonateTenantCommand(id, uid), ct));
    }

    // POST /api/admin/tenants/{id}/license
    [HttpPost("{id:guid}/license")]
    public async Task<IActionResult> GenerateLicense(Guid id, [FromBody] GenerateLicenseRequest req, CancellationToken ct)
        => HandleResult(await Sender.Send(new GenerateTenantLicenseCommand(id, req.ValidityDays, req.Features), ct));

    // PATCH /api/admin/tenants/{id}/subscription  — cloud tenants: set expiry + activate
    [HttpPatch("{id:guid}/subscription")]
    public async Task<IActionResult> RenewSubscription(Guid id, [FromBody] RenewSubscriptionRequest req, CancellationToken ct)
        => HandleResult(await Sender.Send(new RenewTenantSubscriptionCommand(id, req.ExpiresAt), ct));

    // PATCH /api/admin/tenants/{id}/expire  — manually expire a tenant (cloud or on-prem)
    [HttpPatch("{id:guid}/expire")]
    public async Task<IActionResult> Expire(Guid id, CancellationToken ct)
        => HandleResult(await Sender.Send(new ExpireTenantCommand(id), ct));

    // PUT /api/admin/tenants/{id}/connection-strings
    [HttpPut("{id:guid}/connection-strings")]
    public async Task<IActionResult> SetConnectionStrings(Guid id, [FromBody] SetConnectionStringsRequest req, CancellationToken ct)
        => HandleResult(await Sender.Send(new SetTenantConnectionStringsCommand(id, req.IdentityDb, req.PosDb, req.InventoryDb), ct));

    // GET /api/admin/tenants/{id}/users/count
    [HttpGet("{id:guid}/users/count")]
    public async Task<IActionResult> GetUserCount(Guid id, CancellationToken ct)
        => HandleResult(await Sender.Send(new GetTenantUserCountQuery(id), ct));

    // PATCH /api/admin/tenants/{id}/modules
    // Pass { "modules": null } to reset to plan defaults.
    [HttpPatch("{id:guid}/modules")]
    public async Task<IActionResult> SetModules(Guid id, [FromBody] SetModulesRequest req, CancellationToken ct)
        => HandleResult(await Sender.Send(new SetTenantModulesCommand(id, req.Modules), ct));

    // PATCH /api/admin/tenants/{id}/industry
    // Set or change the tenant's industry (activates the matching Industry Pack).
    [HttpPatch("{id:guid}/industry")]
    public async Task<IActionResult> SetIndustry(Guid id, [FromBody] SetIndustryRequest req, CancellationToken ct)
        => HandleResult(await Sender.Send(new SetTenantIndustryCommand(id, req.Industry), ct));

    // DELETE /api/admin/tenants/{id}
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
        => HandleResult(await Sender.Send(new DeleteTenantCommand(id), ct));
}
