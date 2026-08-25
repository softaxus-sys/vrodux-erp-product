using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Employees.Dtos;
using Softaxis.HR.Application.Employees.Queries;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Employees;

internal sealed class GetEmployeeByIdHandler(HrDbContext db)
    : IQueryHandler<GetEmployeeByIdQuery, EmployeeDto>
{
    public async Task<Result<EmployeeDto>> Handle(GetEmployeeByIdQuery query, CancellationToken ct)
    {
        // Mapped through EmployeeMappings.ToDto, never a hand-written projection: this handler
        // used to build EmployeeDto inline and silently returned null for every field added to
        // the DTO afterwards (photo, nationality, compliance and bank details all came back empty).
        var emp = await db.Employees
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == query.Id && !x.IsDeleted, ct);

        if (emp is null)
            return Result.Failure<EmployeeDto>(Error.NotFoundById("Employee", query.Id));

        // Read the linked login's live state rather than storing a copy of it: Identity owns
        // those fields, so a snapshot here would drift the moment someone changes their email.
        LinkedAccountDto? linked = null;
        if (emp.UserId is { } userId)
        {
            linked = await IdentityUserLookup.ForCurrentTenant(db)
                .Where(u => u.Id == userId)
                .Select(u => new LinkedAccountDto(
                    u.Id, u.Email, u.Username,
                    (u.FirstName + " " + u.LastName).Trim(),
                    u.Status, u.EmailVerified, u.LastLoginAt))
                .FirstOrDefaultAsync(ct);
        }

        return Result.Success(EmployeeMappings.ToDto(emp, linked));
    }
}
