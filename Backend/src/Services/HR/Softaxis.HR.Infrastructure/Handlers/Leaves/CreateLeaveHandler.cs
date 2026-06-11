using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Leaves.Commands;
using Softaxis.HR.Application.Leaves.Dtos;
using Softaxis.HR.Domain.Entities;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Leaves;

internal sealed class CreateLeaveHandler(HrDbContext db)
    : ICommandHandler<CreateLeaveCommand, LeaveDto>
{
    public async Task<Result<LeaveDto>> Handle(CreateLeaveCommand cmd, CancellationToken ct)
    {
        var leave = new Leave(
            cmd.EmployeeId, cmd.EmployeeName, cmd.LeaveType,
            cmd.StartDate, cmd.EndDate, cmd.TotalDays, cmd.Reason);

        db.Leaves.Add(leave);
        await db.SaveChangesAsync(ct);

        return Result.Success(LeaveMappings.ToDto(leave));
    }
}
