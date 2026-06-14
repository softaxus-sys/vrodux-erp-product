using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Common.Dtos;
using Softaxis.HR.Application.Payroll.Dtos;
using Softaxis.HR.Application.Payroll.Queries;
using Softaxis.HR.Domain.Entities;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Payroll;

internal sealed class GetPayrollRunsHandler(HrDbContext db)
    : IQueryHandler<GetPayrollRunsQuery, PagedResult<PayrollRunDto>>
{
    public async Task<Result<PagedResult<PayrollRunDto>>> Handle(GetPayrollRunsQuery query, CancellationToken ct)
    {
        IQueryable<PayrollRun> q = db.PayrollRuns.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(query.Period))
            q = q.Where(x => x.Period == query.Period);

        if (!string.IsNullOrWhiteSpace(query.Status))
            q = q.Where(x => x.Status == query.Status);

        var total      = await q.CountAsync(ct);
        var totalPages = (int)Math.Ceiling((double)total / query.PageSize);

        var items = await q
            .OrderByDescending(x => x.Period)
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .Select(x => new PayrollRunDto(
                x.Id, x.RunNumber, x.Period,
                x.TotalBasicSalary, x.TotalAllowances, x.TotalDeductions, x.TotalNetSalary,
                x.Status, x.Notes, x.CreatedByName, x.RejectionReason, x.RejectedByName,
                x.Slips.Count,
                x.ProcessedAt, x.PaidAt, x.RejectedAt, x.CreatedAt, x.UpdatedAt))
            .ToListAsync(ct);

        return Result.Success(new PagedResult<PayrollRunDto>(
            items, query.Page, query.PageSize, total, totalPages, query.Page < totalPages, query.Page > 1));
    }
}
