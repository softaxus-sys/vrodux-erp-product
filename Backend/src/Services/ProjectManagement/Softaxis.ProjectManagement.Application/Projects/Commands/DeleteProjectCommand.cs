using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.ProjectManagement.Application.Projects.Commands;

/// <summary>Soft-deletes a project. Fails with Project.HasIssues if it still has issues.</summary>
public sealed record DeleteProjectCommand(Guid Id) : ICommand;
