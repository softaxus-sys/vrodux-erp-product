using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.HR.Application.Payroll.Commands;

public sealed record RejectPayrollRunCommand(Guid Id, string? Reason, string? RejectedByName) : ICommand;
