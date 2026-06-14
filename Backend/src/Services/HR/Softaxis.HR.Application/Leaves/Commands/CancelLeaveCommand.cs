using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.HR.Application.Leaves.Commands;

public sealed record CancelLeaveCommand(Guid Id) : ICommand;
