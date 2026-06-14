using Softaxis.HR.Application.Leaves.Dtos;
using Softaxis.HR.Domain.Entities;

namespace Softaxis.HR.Infrastructure.Handlers.Leaves;

internal static class LeaveMappings
{
    public static LeaveDto ToDto(Leave x) => new(
        x.Id, x.LeaveNumber, x.EmployeeId, x.EmployeeName, x.LeaveType,
        x.StartDate, x.EndDate, x.TotalDays, x.Reason, x.Status,
        x.ApprovedById, x.ApproverNotes, x.ApprovedAt, x.CreatedAt, x.UpdatedAt);
}
