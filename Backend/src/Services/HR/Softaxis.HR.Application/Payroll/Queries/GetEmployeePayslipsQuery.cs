using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.HR.Application.Common.Dtos;
using Softaxis.HR.Application.Payroll.Dtos;

namespace Softaxis.HR.Application.Payroll.Queries;

/// <summary>
/// Payslips issued to one employee. Only runs that have actually been processed or paid
/// are returned — a draft or rejected run is not a payslip the employee has received.
/// </summary>
/// <remarks>Pages in SQL: an employee accumulates a payslip a month for as long as they are
/// employed, so the unbounded form grows without limit.</remarks>
public sealed record GetEmployeePayslipsQuery(
    Guid EmployeeId,
    int  Page     = 1,
    int  PageSize = 24) : IQuery<PagedResult<EmployeePayslipDto>>;
