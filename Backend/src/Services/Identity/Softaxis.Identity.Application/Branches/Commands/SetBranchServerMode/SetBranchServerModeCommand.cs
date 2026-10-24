using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Identity.Application.Branches.Commands.SetBranchServerMode;

/// <summary>Moves a branch between running on the cloud and running on its own server.</summary>
public sealed record SetBranchServerModeCommand(Guid Id, string Mode) : ICommand;
