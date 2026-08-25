using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Abstractions;
using Softaxis.HR.Domain.Entities;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Self;

/// <summary>
/// Resolves the employee record behind the signed-in user.
///
/// <para><b>The whole security property of self-service lives here.</b> Every /me handler resolves
/// its subject through this and never accepts an employee id from the caller, so the endpoints are
/// structurally incapable of returning another person's data.</para>
///
/// <para>A user with no linked employee is a normal state — an external accountant, the tenant
/// owner, a portal-only account — so it returns a plain, explanatory failure rather than an error.</para>
/// </summary>
internal static class CurrentEmployee
{
    public const string NotLinkedCode = "Employee.NotLinked";

    private const string NotLinkedMessage =
        "Your login is not linked to an employee record. Ask HR to link your account.";

    public static async Task<Result<Employee>> ResolveAsync(
        HrDbContext db, ICurrentUser currentUser, CancellationToken ct)
    {
        if (currentUser.Id is not { } userId)
            return Result.Failure<Employee>(Error.Custom("Auth.Unresolved", "No signed-in user."));

        // Tenant scoping is automatic: db.Employees carries the global tenant filter.
        var employee = await db.Employees
            .AsNoTracking()
            .FirstOrDefaultAsync(e => !e.IsDeleted && e.UserId == userId, ct);

        return employee is null
            ? Result.Failure<Employee>(Error.Custom(NotLinkedCode, NotLinkedMessage))
            : Result.Success(employee);
    }

    /// <summary>Tracked variant, for handlers that write.</summary>
    public static async Task<Result<Employee>> ResolveTrackedAsync(
        HrDbContext db, ICurrentUser currentUser, CancellationToken ct)
    {
        if (currentUser.Id is not { } userId)
            return Result.Failure<Employee>(Error.Custom("Auth.Unresolved", "No signed-in user."));

        var employee = await db.Employees
            .FirstOrDefaultAsync(e => !e.IsDeleted && e.UserId == userId, ct);

        return employee is null
            ? Result.Failure<Employee>(Error.Custom(NotLinkedCode, NotLinkedMessage))
            : Result.Success(employee);
    }
}
