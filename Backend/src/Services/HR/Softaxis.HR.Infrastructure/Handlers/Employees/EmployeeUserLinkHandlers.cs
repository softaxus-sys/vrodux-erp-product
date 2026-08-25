using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.HR.Application.Employees.Commands;
using Softaxis.HR.Application.Employees.Dtos;
using Softaxis.HR.Application.Employees.Queries;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Employees;

/// <summary>
/// Shared access to the Identity user view. The view carries Identity's own TenantId and is
/// outside the shadow-TenantId mechanism, so every query here filters the tenant BY HAND —
/// forgetting it would surface another tenant's logins.
/// </summary>
internal static class IdentityUserLookup
{
    public static IQueryable<IdentityUserView> ForCurrentTenant(HrDbContext db)
    {
        var tenantId = TenantAmbient.TenantId;

        return db.IdentityUsers
            .AsNoTracking()
            .Where(u => !u.IsDeleted && u.TenantId != null && u.TenantId == tenantId);
    }
}

internal sealed class FindUserMatchHandler(HrDbContext db)
    : IQueryHandler<FindUserMatchQuery, UserMatchDto?>
{
    public async Task<Result<UserMatchDto?>> Handle(FindUserMatchQuery query, CancellationToken ct)
    {
        var email = (query.Email ?? string.Empty).Trim().ToLowerInvariant();
        if (email.Length == 0) return Result.Success<UserMatchDto?>(null);

        var user = await IdentityUserLookup.ForCurrentTenant(db)
            .Where(u => u.Email.ToLower() == email)
            .Select(u => new { u.Id, u.Email, u.Username, u.FirstName, u.LastName, u.Status })
            .FirstOrDefaultAsync(ct);
        if (user is null)
        {
            // Nothing in this workspace. Before reporting "not found", check whether the address
            // is registered elsewhere: identity.users has a GLOBAL unique index on email (login
            // resolves an account by address alone, with no workspace to disambiguate it), so a
            // create would fail with "email already registered" and contradict the search we just
            // did. Only a boolean crosses the tenant boundary — no name, workspace or status.
            var elsewhere = await db.IdentityUsers.AsNoTracking()
                .AnyAsync(u => !u.IsDeleted && u.Email.ToLower() == email, ct);

            return elsewhere
                ? Result.Success<UserMatchDto?>(new UserMatchDto(
                    Guid.Empty, query.Email, string.Empty, string.Empty, string.Empty,
                    null, RegisteredInAnotherWorkspace: true))
                : Result.Success<UserMatchDto?>(null);
        }

        // A login already claimed by another employee must be reported, not offered — the unique
        // index would reject it anyway, and the user deserves to know why.
        var takenBy = await db.Employees
            .AsNoTracking()
            .Where(e => !e.IsDeleted && e.UserId == user.Id)
            .Select(e => e.FirstName + " " + e.LastName)
            .FirstOrDefaultAsync(ct);

        return Result.Success<UserMatchDto?>(new UserMatchDto(
            user.Id, user.Email, user.Username,
            $"{user.FirstName} {user.LastName}".Trim(), user.Status, takenBy));
    }
}

internal sealed class LinkEmployeeUserHandler(HrDbContext db)
    : ICommandHandler<LinkEmployeeUserCommand>
{
    public async Task<Result> Handle(LinkEmployeeUserCommand cmd, CancellationToken ct)
    {
        var employee = await db.Employees.FirstOrDefaultAsync(
            e => e.Id == cmd.EmployeeId && !e.IsDeleted, ct);
        if (employee is null)
            return Result.Failure(Error.NotFoundById("Employee", cmd.EmployeeId));

        // The login must belong to this tenant. Without this check a guessed id from another
        // tenant could be linked, and the employee profile would then read that tenant's user.
        var userExists = await IdentityUserLookup.ForCurrentTenant(db)
            .AnyAsync(u => u.Id == cmd.UserId, ct);
        if (!userExists)
            return Result.Failure(Error.NotFoundById("User", cmd.UserId));

        var takenBy = await db.Employees
            .AsNoTracking()
            .Where(e => !e.IsDeleted && e.UserId == cmd.UserId && e.Id != cmd.EmployeeId)
            .Select(e => e.FirstName + " " + e.LastName)
            .FirstOrDefaultAsync(ct);
        if (takenBy is not null)
            return Result.Failure(Error.Custom(
                "Employee.Duplicate", $"That login is already linked to {takenBy}."));

        employee.LinkUser(cmd.UserId);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class UnlinkEmployeeUserHandler(HrDbContext db)
    : ICommandHandler<UnlinkEmployeeUserCommand>
{
    public async Task<Result> Handle(UnlinkEmployeeUserCommand cmd, CancellationToken ct)
    {
        var employee = await db.Employees.FirstOrDefaultAsync(
            e => e.Id == cmd.EmployeeId && !e.IsDeleted, ct);
        if (employee is null)
            return Result.Failure(Error.NotFoundById("Employee", cmd.EmployeeId));

        // Neither record is deleted — the link simply goes dormant.
        employee.UnlinkUser();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
