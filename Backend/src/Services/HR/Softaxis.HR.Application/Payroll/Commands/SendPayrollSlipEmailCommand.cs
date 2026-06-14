using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.HR.Application.Payroll.Dtos;

namespace Softaxis.HR.Application.Payroll.Commands;

public sealed record SendPayrollSlipEmailCommand(Guid RunId, Guid SlipId) : ICommand<SendPayrollSlipEmailResultDto>;
