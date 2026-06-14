using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.HR.Application.Payroll.Dtos;

namespace Softaxis.HR.Application.Payroll.Queries;

public sealed record GetPayrollSummaryQuery : IQuery<PayrollSummaryDto>;
