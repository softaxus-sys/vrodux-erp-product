using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.ProjectManagement.Application.Projects.Dtos;

namespace Softaxis.ProjectManagement.Application.Projects.Commands;

public sealed record ArchiveProjectCommand(Guid Id) : ICommand<ProjectDto>;

public sealed record ActivateProjectCommand(Guid Id) : ICommand<ProjectDto>;
