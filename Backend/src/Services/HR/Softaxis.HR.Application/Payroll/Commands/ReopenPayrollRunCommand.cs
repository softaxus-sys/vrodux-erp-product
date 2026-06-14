using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.HR.Application.Payroll.Commands;

public sealed record ReopenPayrollRunCommand(Guid Id) : ICommand;
