using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Departments.Commands;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Departments;

internal sealed class DeleteDepartmentHandler(HrDbContext db)
    : ICommandHandler<DeleteDepartmentCommand>
{
    public async Task<Result> Handle(DeleteDepartmentCommand cmd, CancellationToken ct)
    {
        var dept = await db.Departments.FindAsync([cmd.Id], ct);
        if (dept is null)
            return Result.Failure(Error.NotFoundById("Department", cmd.Id));

        dept.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
