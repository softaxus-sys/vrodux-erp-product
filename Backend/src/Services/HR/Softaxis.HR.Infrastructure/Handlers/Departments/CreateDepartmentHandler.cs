using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Departments.Commands;
using Softaxis.HR.Application.Departments.Dtos;
using Softaxis.HR.Domain.Entities;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Departments;

internal sealed class CreateDepartmentHandler(HrDbContext db)
    : ICommandHandler<CreateDepartmentCommand, DepartmentDto>
{
    public async Task<Result<DepartmentDto>> Handle(
        CreateDepartmentCommand cmd, CancellationToken ct)
    {
        var dept = new Department(cmd.Name, cmd.Code, cmd.Description);
        if (!cmd.IsActive || cmd.ManagerId.HasValue)
            dept.Update(cmd.Name, cmd.Code, cmd.Description, cmd.ManagerId, cmd.IsActive);

        db.Departments.Add(dept);
        await db.SaveChangesAsync(ct);

        return Result.Success(new DepartmentDto(
            dept.Id, dept.Name, dept.Code, dept.Description,
            dept.ManagerId, dept.IsActive, 0, dept.CreatedAt, dept.UpdatedAt));
    }
}
