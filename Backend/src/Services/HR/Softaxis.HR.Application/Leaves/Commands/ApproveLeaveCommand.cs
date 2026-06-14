using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.HR.Application.Leaves.Commands;

public sealed record ApproveLeaveCommand(Guid Id, Guid ApproverId, string? Notes) : ICommand;
