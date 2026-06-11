using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.HR.Application.Payroll.Commands;

public sealed record ProcessPayrollRunCommand(Guid Id) : ICommand;
