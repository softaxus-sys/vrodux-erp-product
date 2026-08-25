using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Payroll.Dtos;
using Softaxis.HR.Application.Payroll.Queries;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Payroll;

internal sealed class GetPayrollRunByIdHandler(HrDbContext db)
    : IQueryHandler<GetPayrollRunByIdQuery, PayrollRunDetailDto>
{
    public async Task<Result<PayrollRunDetailDto>> Handle(GetPayrollRunByIdQuery query, CancellationToken ct)
    {
        var run = await db.PayrollRuns
            .AsNoTracking()
            .Include(x => x.Slips)
            .FirstOrDefaultAsync(x => x.Id == query.Id, ct);

        if (run is null)
            return Result.Failure<PayrollRunDetailDto>(Error.NotFoundById("PayrollRun", query.Id));

        var bank = await PayrollBankLookup.ForRunAsync(db, run, ct);

        return Result.Success(PayrollMappings.ToDetailDto(run, bank));
    }
}
