using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.HR.Application.Common.Dtos;
using Softaxis.HR.Application.Payroll.Dtos;

namespace Softaxis.HR.Application.Payroll.Queries;

public sealed record GetPayrollRunsQuery(
    int     Page     = 1,
    int     PageSize = 20,
    string? Period   = null,
    string? Status   = null
) : IQuery<PagedResult<PayrollRunDto>>;
