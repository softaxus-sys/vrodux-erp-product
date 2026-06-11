using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Leaves.Dtos;
using Softaxis.HR.Application.Leaves.Queries;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Leaves;

internal sealed class GetLeaveByIdHandler(HrDbContext db)
    : IQueryHandler<GetLeaveByIdQuery, LeaveDto>
{
    public async Task<Result<LeaveDto>> Handle(GetLeaveByIdQuery query, CancellationToken ct)
    {
        var leave = await db.Leaves
            .AsNoTracking()
            .Where(x => x.Id == query.Id)
            .Select(x => new LeaveDto(
                x.Id, x.LeaveNumber, x.EmployeeId, x.EmployeeName, x.LeaveType,
                x.StartDate, x.EndDate, x.TotalDays, x.Reason, x.Status,
                x.ApprovedById, x.ApproverNotes, x.ApprovedAt, x.CreatedAt, x.UpdatedAt))
            .FirstOrDefaultAsync(ct);

        if (leave is null)
            return Result.Failure<LeaveDto>(Error.NotFoundById("Leave", query.Id));

        return Result.Success(leave);
    }
}
