using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.HR.Application.Departments.Commands;

public sealed record DeleteDepartmentCommand(Guid Id) : ICommand;
