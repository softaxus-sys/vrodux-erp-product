using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.HR.Application.Payroll.Commands;

public sealed record UpdatePayrollSlipCommand(
    Guid    RunId,
    Guid    SlipId,
    decimal Allowances,
    decimal Deductions,
    string? Notes
) : ICommand;
