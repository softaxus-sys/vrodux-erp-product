using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Identity.Application.Users.Commands.AdminResetPassword;
using Softaxis.Identity.Application.Users.Commands.AssignRole;
using Softaxis.Identity.Application.Users.Commands.ChangePassword;
using Softaxis.Identity.Application.Users.Commands.CreateUser;
using Softaxis.Identity.Application.Users.Commands.ProvisionUser;
using Softaxis.Identity.Application.Users.Commands.DeleteUser;
using Softaxis.Identity.Application.Users.Commands.GrantSelfService;
using Softaxis.Identity.Application.Users.Commands.RemoveRole;
using Softaxis.Identity.Application.Users.Commands.UpdateUser;
using Softaxis.Identity.Application.Users.Commands.UpdateUserPermissions;
using Softaxis.Identity.Application.Users.Queries.GetUserById;
using Softaxis.Identity.Application.Users.Queries.GetUsers;

namespace Softaxis.Identity.API.Controllers;

/// <summary>
/// User management — CRUD, role assignment, password changes.
/// </summary>
[Authorize]
[Tags("Users")]
public sealed class UsersController(ISender sender) : BaseApiController(sender)
{
    /// <summary>Get a paginated list of users.</summary>
    [HttpGet]
    public async Task<IActionResult> GetUsers(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        [FromQuery] string? sortBy = null,
        [FromQuery] bool sortDesc = false,
        CancellationToken ct = default)
        => HandleResult(await Sender.Send(new GetUsersQuery(page, pageSize, search, sortBy, sortDesc), ct));

    /// <summary>Get a user by ID with full role and permission detail.</summary>
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
        => HandleResult(await Sender.Send(new GetUserByIdQuery(id), ct));

    /// <summary>Create a new user and optionally assign roles.</summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateUserCommand command, CancellationToken ct)
        => HandleResult(await Sender.Send(command, ct), 201);

    /// <summary>
    /// Creates a login for someone standing in front of an administrator — HR giving an employee
    /// portal access. Returns a server-generated temporary password ONCE; it is never retrievable
    /// afterwards, only its hash is stored. The account is usable immediately and the holder must
    /// replace the password at first sign-in.
    /// </summary>
    [HttpPost("provision")]
    public async Task<IActionResult> Provision([FromBody] ProvisionUserCommand command, CancellationToken ct)
        => HandleResult(await Sender.Send(command, ct), 201);

    /// <summary>
    /// Give an existing login access to their own HR record — profile, leave, attendance and
    /// payslips. Additive: assigns one extra role, never removes what they already have.
    /// </summary>
    [HttpPost("{id:guid}/grant-self-service")]
    public async Task<IActionResult> GrantSelfService(Guid id, CancellationToken ct)
        => HandleResult(await Sender.Send(new GrantSelfServiceCommand(id), ct));

    /// <summary>Update a user's profile (name, phone, avatar).</summary>
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateUserRequest request, CancellationToken ct)
        => HandleResult(await Sender.Send(
            new UpdateUserCommand(id, request.FirstName, request.LastName, request.PhoneNumber, request.AvatarUrl), ct));

    /// <summary>Soft-delete a user and revoke all their sessions.</summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
        => HandleResult(await Sender.Send(new DeleteUserCommand(id), ct));

    /// <summary>Assign a role to a user.</summary>
    [HttpPost("{id:guid}/roles")]
    public async Task<IActionResult> AssignRole(Guid id, [FromBody] RoleAssignRequest request, CancellationToken ct)
        => HandleResult(await Sender.Send(new AssignRoleCommand(id, request.RoleId), ct));

    /// <summary>Remove a role from a user.</summary>
    [HttpDelete("{id:guid}/roles/{roleId:guid}")]
    public async Task<IActionResult> RemoveRole(Guid id, Guid roleId, CancellationToken ct)
        => HandleResult(await Sender.Send(new RemoveRoleCommand(id, roleId), ct));

    /// <summary>
    /// Replace the user's per-user permission overrides (grants + denies on top of their roles).
    /// Send an empty list to clear all overrides.
    /// </summary>
    [HttpPut("{id:guid}/permissions")]
    public async Task<IActionResult> UpdatePermissions(Guid id, [FromBody] UpdateUserPermissionsRequest request, CancellationToken ct)
        => HandleResult(await Sender.Send(
            new UpdateUserPermissionsCommand(
                id,
                request.Overrides.Select(o => new PermissionOverrideInput(o.PermissionId, o.IsGranted)).ToList()),
            ct));

    /// <summary>
    /// Change the user's password (requires the user's current password — for self-service).
    /// </summary>
    [HttpPost("{id:guid}/change-password")]
    public async Task<IActionResult> ChangePassword(Guid id, [FromBody] ChangePasswordRequest request, CancellationToken ct)
        => HandleResult(await Sender.Send(new ChangePasswordCommand(id, request.CurrentPassword, request.NewPassword), ct));

    /// <summary>
    /// Admin: forcibly reset a user's password without knowing their current password.
    /// </summary>
    [HttpPost("{id:guid}/reset-password")]
    public async Task<IActionResult> AdminResetPassword(Guid id, [FromBody] AdminResetPasswordRequest request, CancellationToken ct)
        => HandleResult(await Sender.Send(new AdminResetPasswordCommand(id, request.NewPassword), ct));
}

// ── Request models ────────────────────────────────────────────────────────────
public sealed record UpdateUserRequest(string FirstName, string LastName, string? PhoneNumber, string? AvatarUrl);
public sealed record RoleAssignRequest(Guid RoleId);
public sealed record ChangePasswordRequest(string CurrentPassword, string NewPassword);
public sealed record AdminResetPasswordRequest(string NewPassword);
public sealed record UpdateUserPermissionsRequest(List<PermissionOverrideRequest> Overrides);
public sealed record PermissionOverrideRequest(Guid PermissionId, bool IsGranted);
