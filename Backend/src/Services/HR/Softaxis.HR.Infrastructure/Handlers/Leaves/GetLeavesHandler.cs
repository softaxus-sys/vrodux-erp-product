using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Common.Dtos;
using Softaxis.HR.Application.Leaves.Dtos;
using Softaxis.HR.Application.Leaves.Queries;
using Softaxis.HR.Domain.Entities;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Leaves;

internal sealed class GetLeavesHandler(HrDbContext db)
    : IQueryHandler<GetLeavesQuery, PagedResult<LeaveDto>>
{
    public async Task<Result<PagedResult<LeaveDto>>> Handle(GetLeavesQuery query, CancellationToken ct)
    {
        IQueryable<Leave> q = db.Leaves.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(query.Search))
            q = q.Where(x =>
                x.LeaveNumber.Contains(query.Search) ||
                x.EmployeeName.Contains(query.Search));

        if (!string.IsNullOrWhiteSpace(query.Status))
            q = q.Where(x => x.Status == query.Status);

        if (!string.IsNullOrWhiteSpace(query.LeaveType))
            q = q.Where(x => x.LeaveType == query.LeaveType);

        if (query.EmployeeId.HasValue)
            q = q.Where(x => x.EmployeeId == query.EmployeeId.Value);

        var total      = await q.CountAsync(ct);
        var totalPages = (int)Math.Ceiling((double)total / query.PageSize);

        var items = await q
            .OrderByDescending(x => x.CreatedAt)
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .Select(x => new LeaveDto(
                x.Id, x.LeaveNumber, x.EmployeeId, x.EmployeeName, x.LeaveType,
                x.StartDate, x.EndDate, x.TotalDays, x.Reason, x.Status,
                x.ApprovedById, x.ApproverNotes, x.ApprovedAt, x.CreatedAt, x.UpdatedAt))
            .ToListAsync(ct);

        return Result.Success(new PagedResult<LeaveDto>(
            items, query.Page, query.PageSize, total, totalPages, query.Page < totalPages, query.Page > 1));
    }
}
