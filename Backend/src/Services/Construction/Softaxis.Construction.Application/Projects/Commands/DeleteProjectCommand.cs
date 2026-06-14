using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Construction.Application.Projects.Commands;

public sealed record DeleteProjectCommand(Guid Id) : ICommand;
