using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Identity.Application.Branches.Commands.DeleteBranch;

public sealed record DeleteBranchCommand(Guid Id) : ICommand;
