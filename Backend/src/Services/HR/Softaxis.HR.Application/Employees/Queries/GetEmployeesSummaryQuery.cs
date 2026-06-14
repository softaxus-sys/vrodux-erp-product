using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.HR.Application.Employees.Dtos;

namespace Softaxis.HR.Application.Employees.Queries;

public sealed record GetEmployeesSummaryQuery : IQuery<EmployeesSummaryDto>;
