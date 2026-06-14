using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.HR.Application.Leaves.Commands;

public sealed record RejectLeaveCommand(Guid Id, Guid ApproverId, string? Notes) : ICommand;
