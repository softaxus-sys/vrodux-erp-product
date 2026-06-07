using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Identity.Application.Users.Commands.AssignRole;
using Softaxis.Identity.Application.Users.Commands.ChangePassword;
using Softaxis.Identity.Application.Users.Commands.CreateUser;
using Softaxis.Identity.Application.Users.Commands.DeleteUser;
using Softaxis.Identity.Application.Users.Commands.RemoveRole;
using Softaxis.Identity.Application.Users.Commands.UpdateUser;
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

    /// <summary>Change the user's password.</summary>
    [HttpPost("{id:guid}/change-password")]
    public async Task<IActionResult> ChangePassword(Guid id, [FromBody] ChangePasswordRequest request, CancellationToken ct)
        => HandleResult(await Sender.Send(new ChangePasswordCommand(id, request.CurrentPassword, request.NewPassword), ct));
}

// ── Request models ────────────────────────────────────────────────────────────
public sealed record UpdateUserRequest(string FirstName, string LastName, string? PhoneNumber, string? AvatarUrl);
public sealed record RoleAssignRequest(Guid RoleId);
public sealed record ChangePasswordRequest(string CurrentPassword, string NewPassword);
