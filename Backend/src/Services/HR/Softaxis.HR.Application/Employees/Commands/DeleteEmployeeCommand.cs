using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.HR.Application.Employees.Commands;

public sealed record DeleteEmployeeCommand(Guid Id) : ICommand;
