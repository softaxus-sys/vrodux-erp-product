using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.HR.Application.Payroll.Dtos;

namespace Softaxis.HR.Application.Payroll.Queries;

/// <summary>
/// Payslips issued to one employee. Only runs that have actually been processed or paid
/// are returned — a draft or rejected run is not a payslip the employee has received.
/// </summary>
public sealed record GetEmployeePayslipsQuery(Guid EmployeeId) : IQuery<IReadOnlyList<EmployeePayslipDto>>;
