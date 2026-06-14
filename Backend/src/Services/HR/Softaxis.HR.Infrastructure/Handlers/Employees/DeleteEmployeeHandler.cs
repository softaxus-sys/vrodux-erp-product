using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Employees.Commands;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Employees;

internal sealed class DeleteEmployeeHandler(HrDbContext db)
    : ICommandHandler<DeleteEmployeeCommand>
{
    public async Task<Result> Handle(DeleteEmployeeCommand cmd, CancellationToken ct)
    {
        var employee = await db.Employees.FindAsync([cmd.Id], ct);
        if (employee is null)
            return Result.Failure(Error.NotFoundById("Employee", cmd.Id));

        employee.Delete();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
