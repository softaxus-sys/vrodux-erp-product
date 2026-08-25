using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.HR.Application.Employees.Commands;

/// <summary>
/// Links an employee to an Identity login. Always the result of an explicit confirmation in the
/// UI — never inferred from a matching email, because the failure mode of getting it wrong is
/// exposing one person's salary and documents to another.
/// </summary>
public sealed record LinkEmployeeUserCommand(Guid EmployeeId, Guid UserId) : ICommand;

public sealed record UnlinkEmployeeUserCommand(Guid EmployeeId) : ICommand;
