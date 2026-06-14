using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Departments.Commands;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Departments;

internal sealed class UpdateDepartmentHandler(HrDbContext db)
    : ICommandHandler<UpdateDepartmentCommand>
{
    public async Task<Result> Handle(UpdateDepartmentCommand cmd, CancellationToken ct)
    {
        var dept = await db.Departments.FindAsync([cmd.Id], ct);
        if (dept is null)
            return Result.Failure(Error.NotFoundById("Department", cmd.Id));

        dept.Update(cmd.Name, cmd.Code, cmd.Description, cmd.ManagerId, cmd.IsActive);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
